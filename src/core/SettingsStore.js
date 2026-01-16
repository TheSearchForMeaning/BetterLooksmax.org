/**
 * SettingsStore - Centralized settings management
 * 
 * Single source of truth for all settings with schema validation,
 * change notification, and persistence.
 */

import StorageAdapter from './StorageAdapter.js';
import HookSystem from './HookSystem.js';

class SettingsStore {
  constructor() {
    this.storage = StorageAdapter;
    this.hooks = HookSystem;
    
    // Current settings state
    this.settings = {
      version: '1.0.0',
      core: {
        theme: 'dark',
        debugMode: false
      },
      plugins: {}
    };

    // Plugin schemas for validation
    this.schemas = new Map();
    
    // Watchers for setting changes
    this.watchers = new Map();
    
    // Batch update queue
    this.batchQueue = [];
    this.batchTimeout = null;
    
    this.initialized = false;
  }

  /**
   * Initialize settings store by loading from storage
   */
  async init() {
    if (this.initialized) return;

    try {
      const stored = await this.storage.get('settings');
      if (stored.settings) {
        this.settings = this._mergeSettings(this.settings, stored.settings);
      }
      this.initialized = true;
    } catch (error) {
      console.error('[SettingsStore] Failed to load settings:', error);
    }
  }

  /**
   * Merge stored settings with defaults
   */
  _mergeSettings(defaults, stored) {
    return {
      ...defaults,
      ...stored,
      core: { ...defaults.core, ...stored.core },
      plugins: { ...defaults.plugins, ...stored.plugins }
    };
  }

  /**
   * Register a plugin's settings schema
   * @param {string} pluginId - Plugin identifier
   * @param {object} schema - Settings schema definition
   */
  registerSchema(pluginId, schema) {
    this.schemas.set(pluginId, schema);
    
    // Initialize plugin settings with defaults if not exists
    if (!this.settings.plugins[pluginId]) {
      this.settings.plugins[pluginId] = {
        enabled: false,
        settings: this._getDefaults(schema)
      };
    } else {
      // Merge with existing settings to add any new defaults
      const current = this.settings.plugins[pluginId].settings || {};
      const defaults = this._getDefaults(schema);
      this.settings.plugins[pluginId].settings = { ...defaults, ...current };
    }
  }

  /**
   * Extract default values from schema
   */
  _getDefaults(schema) {
    const defaults = {};
    
    Object.entries(schema).forEach(([key, definition]) => {
      if (definition.default !== undefined) {
        defaults[key] = definition.default;
      }
    });
    
    return defaults;
  }

  /**
   * Get a setting value
   * @param {string} pluginId - Plugin ID ('core' for core settings)
   * @param {string} key - Setting key
   * @returns {*} Setting value
   */
  get(pluginId, key) {
    if (pluginId === 'core') {
      return this.settings.core[key];
    }
    
    const plugin = this.settings.plugins[pluginId];
    if (!plugin) return undefined;
    
    // Special keys
    if (key === 'enabled') {
      return plugin.enabled;
    }
    
    return plugin.settings?.[key];
  }

  /**
   * Get all settings for a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {object} All plugin settings
   */
  getAll(pluginId) {
    if (pluginId === 'core') {
      return { ...this.settings.core };
    }
    
    const plugin = this.settings.plugins[pluginId];
    if (!plugin) return null;
    
    return {
      enabled: plugin.enabled,
      ...plugin.settings
    };
  }

  /**
   * Set a setting value
   * @param {string} pluginId - Plugin ID
   * @param {string} key - Setting key
   * @param {*} value - New value
   * @param {boolean} skipValidation - Skip schema validation
   */
  async set(pluginId, key, value, skipValidation = false) {
    // Validate if schema exists
    if (!skipValidation) {
      const isValid = this._validate(pluginId, key, value);
      if (!isValid) {
        throw new Error(`Invalid value for ${pluginId}.${key}`);
      }
    }

    const oldValue = this.get(pluginId, key);
    
    // Update in memory
    if (pluginId === 'core') {
      this.settings.core[key] = value;
    } else {
      if (!this.settings.plugins[pluginId]) {
        this.settings.plugins[pluginId] = { enabled: false, settings: {} };
      }
      
      if (key === 'enabled') {
        this.settings.plugins[pluginId].enabled = value;
      } else {
        this.settings.plugins[pluginId].settings[key] = value;
      }
    }

    // Batch persist to storage
    this._queuePersist();

    // Notify watchers
    this._notifyWatchers(pluginId, key, value, oldValue);

    // Emit hooks
    await this.hooks.action('settings:changed', { pluginId, key, value, oldValue });
    await this.hooks.action(`settings:plugin-changed:${pluginId}`, { key, value, oldValue });
  }

  /**
   * Set multiple settings at once
   * @param {string} pluginId - Plugin ID
   * @param {object} settings - Key-value pairs to set
   */
  async setMany(pluginId, settings) {
    for (const [key, value] of Object.entries(settings)) {
      await this.set(pluginId, key, value);
    }
  }

  /**
   * Validate a setting value against schema
   */
  _validate(pluginId, key, value) {
    const schema = this.schemas.get(pluginId);
    if (!schema || !schema[key]) {
      return true; // No schema, allow any value
    }

    const definition = schema[key];
    const { type, enum: enumValues, min, max, validator } = definition;

    // Type validation
    if (type) {
      switch (type) {
        case 'boolean':
          if (typeof value !== 'boolean') return false;
          break;
        case 'string':
          if (typeof value !== 'string') return false;
          break;
        case 'number':
          if (typeof value !== 'number') return false;
          if (min !== undefined && value < min) return false;
          if (max !== undefined && value > max) return false;
          break;
        case 'array':
          if (!Array.isArray(value)) return false;
          break;
        case 'object':
          if (typeof value !== 'object' || value === null) return false;
          break;
      }
    }

    // Enum validation
    if (enumValues && !enumValues.includes(value)) {
      return false;
    }

    // Custom validator
    if (validator && typeof validator === 'function') {
      return validator(value);
    }

    return true;
  }

  /**
   * Reset plugin settings to defaults
   * @param {string} pluginId - Plugin ID
   */
  async reset(pluginId) {
    const schema = this.schemas.get(pluginId);
    if (!schema) {
      throw new Error(`No schema found for plugin: ${pluginId}`);
    }

    const defaults = this._getDefaults(schema);
    this.settings.plugins[pluginId].settings = defaults;
    
    await this._persist();
    
    await this.hooks.action('settings:reset', { pluginId });
  }

  /**
   * Watch for changes to a specific setting
   * @param {string} pluginId - Plugin ID
   * @param {string} key - Setting key (null for all settings)
   * @param {Function} callback - Called with (value, oldValue)
   * @returns {Function} Unwatch function
   */
  watch(pluginId, key, callback) {
    const watchKey = key ? `${pluginId}.${key}` : pluginId;
    
    if (!this.watchers.has(watchKey)) {
      this.watchers.set(watchKey, new Set());
    }
    
    this.watchers.get(watchKey).add(callback);
    
    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(watchKey);
      if (watchers) {
        watchers.delete(callback);
      }
    };
  }

  /**
   * Notify watchers of a change
   */
  _notifyWatchers(pluginId, key, value, oldValue) {
    // Notify specific key watchers
    const specificKey = `${pluginId}.${key}`;
    const specificWatchers = this.watchers.get(specificKey);
    if (specificWatchers) {
      specificWatchers.forEach(callback => {
        try {
          callback(value, oldValue);
        } catch (error) {
          console.error('[SettingsStore] Error in watcher:', error);
        }
      });
    }

    // Notify plugin-wide watchers
    const pluginWatchers = this.watchers.get(pluginId);
    if (pluginWatchers) {
      pluginWatchers.forEach(callback => {
        try {
          callback({ key, value, oldValue });
        } catch (error) {
          console.error('[SettingsStore] Error in watcher:', error);
        }
      });
    }
  }

  /**
   * Queue a persist operation (batched)
   */
  _queuePersist() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this._persist();
      this.batchTimeout = null;
    }, 500); // Batch writes within 500ms window
  }

  /**
   * Persist settings to storage
   */
  async _persist() {
    try {
      await this.storage.set({ settings: this.settings });
    } catch (error) {
      console.error('[SettingsStore] Failed to persist settings:', error);
    }
  }

  /**
   * Export all settings as JSON
   * @returns {string} JSON string of settings
   */
  export() {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON
   * @param {string} json - JSON string to import
   * @param {boolean} merge - Merge with existing (true) or replace (false)
   */
  async import(json, merge = true) {
    try {
      const imported = JSON.parse(json);
      
      if (merge) {
        this.settings = this._mergeSettings(this.settings, imported);
      } else {
        this.settings = imported;
      }
      
      await this._persist();
      await this.hooks.action('settings:imported', { merge });
      
      return true;
    } catch (error) {
      console.error('[SettingsStore] Failed to import settings:', error);
      return false;
    }
  }

  /**
   * Check if a plugin is enabled
   * @param {string} pluginId - Plugin ID
   * @returns {boolean}
   */
  isEnabled(pluginId) {
    return this.settings.plugins[pluginId]?.enabled || false;
  }

  /**
   * Enable a plugin
   * @param {string} pluginId - Plugin ID
   */
  async enable(pluginId) {
    await this.set(pluginId, 'enabled', true, true);
  }

  /**
   * Disable a plugin
   * @param {string} pluginId - Plugin ID
   */
  async disable(pluginId) {
    await this.set(pluginId, 'enabled', false, true);
  }

  /**
   * Get all enabled plugins
   * @returns {string[]} Array of enabled plugin IDs
   */
  getEnabledPlugins() {
    return Object.entries(this.settings.plugins)
      .filter(([, data]) => data.enabled)
      .map(([id]) => id);
  }

  /**
   * Check if a specific plugin is enabled
   * @param {string} pluginId - Plugin ID
   * @returns {boolean} True if plugin is enabled
   */
  isPluginEnabled(pluginId) {
    return this.settings.plugins[pluginId]?.enabled || false;
  }

  /**
   * Migrate settings from old version to new version
   * @param {Function} migrationFn - Migration function
   */
  async migrate(migrationFn) {
    try {
      const newSettings = await migrationFn(this.settings);
      this.settings = newSettings;
      await this._persist();
      return true;
    } catch (error) {
      console.error('[SettingsStore] Migration failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new SettingsStore();
