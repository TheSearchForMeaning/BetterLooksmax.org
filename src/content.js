/**
 * Content Script - Main entry point for page injection
 * 
 * Initializes the framework, loads plugins, and handles page lifecycle.
 */

import PluginLoader from './core/PluginLoader.js';
import PluginRegistry from './core/PluginRegistry.js';
import LifecycleManager from './core/LifecycleManager.js';
import SettingsStore from './core/SettingsStore.js';
import HookSystem from './core/HookSystem.js';
import IPCManager from './core/IPCManager.js';
import { createPluginAPI } from './api/PluginAPI.js';
import Logger from '../utils/logger.js';

class FrameworkCore {
  constructor() {
    this.logger = Logger.child('Core');
    this.loader = PluginLoader;
    this.registry = PluginRegistry;
    this.lifecycle = LifecycleManager;
    this.settings = SettingsStore;
    this.hooks = HookSystem;
    this.ipc = IPCManager;
    
    this.initialized = false;
    this.initializing = false;
    this.destroyed = false;
    this.pluginAPIs = new Map();
    
    // Track operations in-flight to prevent feedback loops
    this._operationsInFlight = new Set();
    
    // Track event listeners for proper cleanup
    this._eventListeners = [];
    
    // Setup cleanup on page unload
    this._setupUnloadHandler();
  }
  
  /**
   * Setup unload handler for cleanup
   * Content scripts run fresh on each navigation, so this only fires
   * on actual page unload (not SPA navigation)
   */
  _setupUnloadHandler() {
    const unloadHandler = () => {
      this.destroy();
    };
    
    window.addEventListener('beforeunload', unloadHandler);
    this._eventListeners.push({ target: window, event: 'beforeunload', handler: unloadHandler });
  }
  
  /**
   * Destroy framework and cleanup (complete teardown)
   */
  async destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    this.initializing = false;
    
    // Clear in-flight operations immediately
    this._operationsInFlight.clear();
    
    // Clear storage debounce timer
    if (this._storageDebounceTimer) {
      clearTimeout(this._storageDebounceTimer);
      this._storageDebounceTimer = null;
    }
    
    // Destroy IPC first - prevents new messages and rejects pending
    if (this.ipc) {
      this.ipc.destroy();
    }
    
    // Stop all active plugins (without IPC)
    const activePlugins = this.registry.getActivePlugins();
    for (const pluginId of activePlugins) {
      const api = this.pluginAPIs.get(pluginId);
      if (api) {
        try {
          await this.lifecycle.stopPlugin(pluginId, api);
        } catch (error) {
          // Silent during cleanup
        }
      }
    }
    
    // Disconnect DOM observer
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
    
    // Remove all event listeners we registered
    for (const { target, event, handler } of this._eventListeners) {
      try {
        target.removeEventListener(event, handler);
      } catch (error) {
        // Silent during cleanup
      }
    }
    this._eventListeners = [];
    
    // Clear hooks
    this.hooks.clear();
    
    // Clear plugin APIs
    this.pluginAPIs.clear();
    
    this.initialized = false;
  }

  /**
   * Initialize the framework
   */
  async init() {
    // Hard guard: only init once
    if (this.initialized) {
      this.logger.warn('Framework already initialized, skipping init');
      return;
    }
    
    if (this.initializing) {
      this.logger.warn('Framework currently initializing, skipping duplicate init call');
      return;
    }
    
    this.initializing = true;

    try {
      this.logger.info('🚀 Initializing BetterLooksmax Framework...');

      // Initialize settings store
      await this.settings.init();

      // Setup IPC handlers
      this._setupIPCHandlers();

      // Setup core hooks
      this._setupCoreHooks();

      // Discover available plugins
      const discovered = await this.loader.discoverPlugins();
      const pluginNames = discovered.map(id => this.registry.getPluginInfo(id)?.name || id);
      this.logger.info(`📦 Discovered ${discovered.length} plugins: ${pluginNames.join(', ')}`);

      // Load all discovered plugins
      const loaded = await this.loader.loadPlugins(discovered);
      
      // Register plugin schemas immediately after loading
      // This ensures settings entries exist BEFORE we check enabled state
      let schemasRegistered = 0;
      for (const pluginId of discovered) {
        const instance = this.registry.getInstance(pluginId);
        if (instance && instance.settings) {
          this.settings.registerSchema(pluginId, instance.settings);
          schemasRegistered++;
        }
      }
      this.logger.info(`⚙️  Loaded ${loaded.length} plugins (${schemasRegistered} with settings schemas)`);

      // NOW get enabled plugins from settings (schemas are registered)
      const enabledPlugins = this.settings.getEnabledPlugins();
      
      if (enabledPlugins.length > 0) {
        const enabledNames = enabledPlugins.map(id => this.registry.getPluginInfo(id)?.name || id);
        this.logger.info(`✅ ${enabledPlugins.length} plugins enabled in storage: ${enabledNames.join(', ')}`);
        
        // Start enabled plugins directly (don't update storage - it's already correct)
        let startedCount = 0;
        for (let i = 0; i < enabledPlugins.length; i++) {
          const pluginId = enabledPlugins[i];
          try {
            this.logger.info(`[${i+1}/${enabledPlugins.length}] Starting ${pluginId}...`);
            const success = await this._startPluginRuntime(pluginId);
            if (success) {
              startedCount++;
              this.logger.info(`✓ ${pluginId} started`);
            } else {
              this.logger.warn(`✗ ${pluginId} returned false`);
            }
          } catch (error) {
            this.logger.error(`✗ ${pluginId} threw error:`, error);
          }
          this.logger.info(`Progress: ${i+1}/${enabledPlugins.length} processed`);
        }
        this.logger.info(`Result: Started ${startedCount}/${enabledPlugins.length} plugins`);
      } else {
        this.logger.info('ℹ️  No plugins currently enabled');
      }

      // Emit framework ready hook
      await this.hooks.action('framework:ready', {
        discovered: discovered.length,
        enabled: enabledPlugins.length
      });

      // Wait for stable DOM before emitting hooks or starting observers
      await this._waitForStableDOM();
      
      // Emit DOM ready hook only after DOM is stable
      await this.hooks.action('dom:ready', {});

      // Setup performant DOM mutation observer with throttling
      this._setupDOMObserver();

      // Mark as initialized after everything is ready
      this.initialized = true;
      this.initializing = false;

      this.logger.info(`✨ Framework ready (${enabledPlugins.length}/${discovered.length} plugins active)`);
    } catch (error) {
      this.initializing = false;
      this.logger.error('❌ Failed to initialize framework:', error);
      throw error;
    }
  }

  /**
   * Setup IPC message handlers
   */
  _setupIPCHandlers() {
    // Handle plugin enable request
    this.ipc.on('plugin:enable', async (data) => {
      const { pluginId } = data;
      return await this.enablePlugin(pluginId);
    });

    // Handle plugin disable request
    this.ipc.on('plugin:disable', async (data) => {
      const { pluginId } = data;
      return await this.disablePlugin(pluginId);
    });

    // Handle plugin reload request
    this.ipc.on('plugin:reload', async (data) => {
      const { pluginId } = data;
      return await this.reloadPlugin(pluginId);
    });

    // Handle get plugin info request
    this.ipc.on('plugin:getInfo', async (data) => {
      const { pluginId } = data;
      return this.registry.getPluginInfo(pluginId);
    });

    // Handle get all plugins request
    this.ipc.on('plugins:getAll', async () => {
      return this.registry.getAllPluginInfo();
    });

    // Handle settings change request
    this.ipc.on('settings:change', async (data) => {
      const { pluginId, key, value } = data;
      await this.settings.set(pluginId, key, value);
      return { success: true };
    });
    
    // Setup debounced storage listener with relevance filter
    let storageDebounceTimer = null;
    const storageChangeHandler = (changes) => {
      // Hard guard: don't process if destroyed, initializing, or not initialized
      if (this.destroyed || this.initializing || !this.initialized) {
        if (storageDebounceTimer) clearTimeout(storageDebounceTimer);
        return;
      }
      
      // Relevance filter - only react to settings changes
      if (!changes.settings) return;
      
      // Debounce to avoid rapid-fire updates
      if (storageDebounceTimer) clearTimeout(storageDebounceTimer);
      
      storageDebounceTimer = setTimeout(() => {
        // Check again before handling
        if (this.destroyed || this.initializing || !this.initialized) {
          return;
        }
        this._handleStorageChange(changes.settings);
      }, 150);
    };
    
    this.settings.storage.onChanged(storageChangeHandler);
    this._storageChangeHandler = storageChangeHandler;
    this._storageDebounceTimer = storageDebounceTimer;
  }
  
  /**
   * Handle storage changes (debounced and filtered)
   * ONLY reacts to EXTERNAL changes (from other tabs/popup)
   * NOT changes caused by this instance
   */
  async _handleStorageChange(settingsChange) {
    // Hard guard: never react during destruction or before init
    if (this.destroyed || !this.initialized) return;
    
    if (!settingsChange.newValue) return;
    
    const newSettings = settingsChange.newValue;
    const oldSettings = settingsChange.oldValue || {};
    
    // Check for plugin enable/disable changes only
    if (newSettings.plugins && oldSettings.plugins) {
      for (const [pluginId, newPluginData] of Object.entries(newSettings.plugins)) {
        const oldPluginData = oldSettings.plugins?.[pluginId];
        const oldEnabled = oldPluginData?.enabled || false;
        const newEnabled = newPluginData?.enabled || false;
        
        // Only react to enabled state changes
        if (oldEnabled !== newEnabled) {
          // Check if this operation is already in-flight
          const opKey = `${pluginId}:${newEnabled ? 'enable' : 'disable'}`;
          if (this._operationsInFlight.has(opKey)) {
            this.logger.debug(`Ignoring storage echo for ${opKey}`);
            continue;
          }
          
          // Reconcile: sync runtime state with storage state
          if (newEnabled) {
            await this._reconcileEnable(pluginId);
          } else {
            await this._reconcileDisable(pluginId);
          }
        }
      }
    }
  }

  /**
   * Setup core framework hooks
   */
  _setupCoreHooks() {
    // Forward settings changes to IPC
    this.hooks.register('settings:changed', async (context) => {
      const { pluginId, key, value } = context.data;
      await this.ipc.sendEvent('settings:changed', { pluginId, key, value });
    }, { plugin: 'core', priority: 0 });

    // Handle plugin errors
    this.hooks.register('plugin:error', async (context) => {
      const { pluginId, error } = context.data;
      this.logger.error(`Plugin ${pluginId} error:`, error);
      await this.ipc.sendEvent('plugin:error', { pluginId, error: error.message });
    }, { plugin: 'core', priority: 0 });
  }

  /**
   * Wait for stable DOM (performance optimization)
   */
  async _waitForStableDOM() {
    // Wait for DOMContentLoaded if not already fired
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }
    
    // Wait for body to exist
    if (!document.body) {
      await new Promise(resolve => {
        const observer = new MutationObserver(() => {
          if (document.body) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(document.documentElement, { childList: true });
      });
    }
    
    // Additional tick to ensure layout is stable
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  
  /**
   * Setup DOM mutation observer (throttled for performance)
   */
  _setupDOMObserver() {
    if (!document.body) {
      this.logger.warn('Cannot setup DOM observer: body not found');
      return;
    }
    
    let rafId = null;
    let pendingMutations = [];
    
    const observer = new MutationObserver((mutations) => {
      if (this.destroyed) {
        observer.disconnect();
        return;
      }
      
      // Batch mutations
      pendingMutations.push(...mutations);
      
      // Throttle using RAF (60fps max)
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        rafId = null;
        
        if (pendingMutations.length > 0 && !this.destroyed) {
          // Only emit if there are hook handlers (performance)
          if (this.hooks.hasHandlers('dom:mutated')) {
            this.hooks.action('dom:mutated', { 
              mutations: pendingMutations.splice(0)
            });
          } else {
            pendingMutations = [];
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false, // Don't track attributes for performance
      characterData: false // Don't track text changes
    });
    
    this.domObserver = observer;
  }

  /**
   * Enable a plugin (command - updates storage AND runtime)
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Success status
   */
  async enablePlugin(pluginId) {
    // Hard guard: don't operate during destruction
    if (this.destroyed) {
      this.logger.warn(`Cannot enable ${pluginId}: framework destroyed`);
      return false;
    }
    
    const opKey = `${pluginId}:enable`;
    
    // Prevent concurrent operations on same plugin
    if (this._operationsInFlight.has(opKey)) {
      this.logger.debug(`Enable operation already in-flight for ${pluginId}`);
      return true;
    }
    
    // Check storage FIRST (source of truth)
    const storageEnabled = this.settings.isPluginEnabled(pluginId);
    const runtimeState = this.registry.getState(pluginId);
    const runtimeActive = runtimeState === this.registry.STATES.ACTIVE;
    
    // Idempotency: already enabled in both storage and runtime
    if (storageEnabled && runtimeActive) {
      this.logger.debug(`Plugin ${pluginId} already fully enabled`);
      return true;
    }
    
    // Check if currently transitioning
    if (runtimeState === this.registry.STATES.STARTING || runtimeState === this.registry.STATES.LOADING) {
      this.logger.debug(`Plugin ${pluginId} already starting`);
      return true;
    }
    
    try {
      this._operationsInFlight.add(opKey);
      this.logger.info(`Enabling plugin: ${pluginId}`);

      // Update storage first (source of truth)
      if (!storageEnabled) {
        await this.settings.enable(pluginId);
      }

      // Check if destroyed after storage update
      if (this.destroyed) {
        return false;
      }

      // Sync runtime state
      const success = await this._startPluginRuntime(pluginId);

      if (success) {
        this.logger.info(`Plugin ${pluginId} enabled successfully`);
      }

      return success;
    } catch (error) {
      // Don't spam logs for context invalidation
      if (!error.message?.includes('Extension context invalidated') &&
          !error.message?.includes('Context no longer available')) {
        this.logger.error(`Failed to enable plugin ${pluginId}:`, error);
      }
      
      // Only rollback if not destroyed
      if (!this.destroyed) {
        try {
          await this.settings.disable(pluginId);
        } catch (rollbackError) {
          // Silent - context may be gone
        }
      }
      return false;
    } finally {
      this._operationsInFlight.delete(opKey);
    }
  }

  /**
   * Disable a plugin (command - updates storage AND runtime)
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Success status
   */
  async disablePlugin(pluginId) {
    // Hard guard: don't operate during destruction
    if (this.destroyed) {
      this.logger.warn(`Cannot disable ${pluginId}: framework destroyed`);
      return false;
    }
    
    const opKey = `${pluginId}:disable`;
    
    // Prevent concurrent operations on same plugin
    if (this._operationsInFlight.has(opKey)) {
      this.logger.debug(`Disable operation already in-flight for ${pluginId}`);
      return true;
    }
    
    // Check storage FIRST (source of truth)
    const storageEnabled = this.settings.isPluginEnabled(pluginId);
    const runtimeState = this.registry.getState(pluginId);
    const runtimeActive = runtimeState === this.registry.STATES.ACTIVE;
    
    // Idempotency: already disabled in both storage and runtime
    if (!storageEnabled && !runtimeActive) {
      this.logger.debug(`Plugin ${pluginId} already fully disabled`);
      return true;
    }
    
    // Check if currently transitioning
    if (runtimeState === this.registry.STATES.STOPPING) {
      this.logger.debug(`Plugin ${pluginId} already stopping`);
      return true;
    }
    
    try {
      this._operationsInFlight.add(opKey);
      this.logger.info(`Disabling plugin: ${pluginId}`);
      
      // Update storage first (source of truth)
      if (storageEnabled) {
        await this.settings.disable(pluginId);
      }

      // Check if destroyed after storage update
      if (this.destroyed) {
        return false;
      }

      // Sync runtime state
      const success = await this._stopPluginRuntime(pluginId);

      if (success) {
        this.logger.info(`Plugin ${pluginId} disabled successfully`);
      }

      return success;
    } catch (error) {
      // Don't spam logs for context invalidation
      if (!error.message?.includes('Extension context invalidated') &&
          !error.message?.includes('Context no longer available')) {
        this.logger.error(`Failed to disable plugin ${pluginId}:`, error);
      }
      return false;
    } finally {
      this._operationsInFlight.delete(opKey);
    }
  }

  /**
   * Start plugin runtime (internal - does NOT update storage)
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Success status
   */
  async _startPluginRuntime(pluginId) {
    // Create plugin API if not exists
    if (!this.pluginAPIs.has(pluginId)) {
      this.pluginAPIs.set(pluginId, createPluginAPI(pluginId));
    }

    const api = this.pluginAPIs.get(pluginId);

    // Initialize plugin if needed
    const currentState = this.registry.getState(pluginId);
    if (currentState === this.registry.STATES.LOADED) {
      await this.lifecycle.initPlugin(pluginId, api);
    }

    // Start plugin
    return await this.lifecycle.startPlugin(pluginId, api);
  }
  
  /**
   * Stop plugin runtime (internal - does NOT update storage)
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Success status
   */
  async _stopPluginRuntime(pluginId) {
    const api = this.pluginAPIs.get(pluginId);
    if (!api) {
      this.logger.warn(`Plugin API not found for ${pluginId}`);
      return true; // Already cleaned up
    }

    return await this.lifecycle.stopPlugin(pluginId, api);
  }
  
  /**
   * Reconcile enable: sync runtime to storage state (notification handler)
   * Does NOT update storage - only syncs runtime
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Success status
   */
  async _reconcileEnable(pluginId) {
    // Hard guard
    if (this.destroyed) return false;
    
    const runtimeState = this.registry.getState(pluginId);
    
    // Already active - no-op
    if (runtimeState === this.registry.STATES.ACTIVE) {
      this.logger.debug(`Reconcile enable: ${pluginId} already active`);
      return true;
    }
    
    // Already transitioning - no-op
    if (runtimeState === this.registry.STATES.STARTING || runtimeState === this.registry.STATES.LOADING) {
      this.logger.debug(`Reconcile enable: ${pluginId} already transitioning`);
      return true;
    }
    
    this.logger.info(`Reconciling enable for ${pluginId} (external change)`);
    
    try {
      return await this._startPluginRuntime(pluginId);
    } catch (error) {
      this.logger.error(`Failed to reconcile enable for ${pluginId}:`, error);
      return false;
    }
  }
  
  /**
   * Reconcile disable: sync runtime to storage state (notification handler)
   * Does NOT update storage - only syncs runtime
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Success status
   */
  async _reconcileDisable(pluginId) {
    // Hard guard
    if (this.destroyed) return false;
    
    const runtimeState = this.registry.getState(pluginId);
    
    // Already stopped - no-op
    if (runtimeState === this.registry.STATES.STOPPED || runtimeState === this.registry.STATES.UNLOADED) {
      this.logger.debug(`Reconcile disable: ${pluginId} already stopped`);
      return true;
    }
    
    // Already transitioning - no-op
    if (runtimeState === this.registry.STATES.STOPPING) {
      this.logger.debug(`Reconcile disable: ${pluginId} already transitioning`);
      return true;
    }
    
    this.logger.info(`Reconciling disable for ${pluginId} (external change)`);
    
    try {
      return await this._stopPluginRuntime(pluginId);
    } catch (error) {
      this.logger.error(`Failed to reconcile disable for ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Reload a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>} Success status
   */
  async reloadPlugin(pluginId) {
    try {
      this.logger.info(`Reloading plugin: ${pluginId}`);

      const api = this.pluginAPIs.get(pluginId);
      if (!api) {
        throw new Error('Plugin API not found');
      }

      const success = await this.lifecycle.reloadPlugin(pluginId, api);

      if (success) {
        this.logger.info(`Plugin ${pluginId} reloaded successfully`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to reload plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Get framework statistics
   * @returns {object} Framework stats
   */
  getStats() {
    return {
      initialized: this.initialized,
      registry: this.registry.getStats(),
      loader: this.loader.getStats(),
      lifecycle: this.lifecycle.getStats(),
      hooks: {
        registered: this.hooks.getRegisteredHooks().length
      }
    };
  }
}

// Create and initialize framework instance (only once)
let framework;

if (typeof window !== 'undefined' && window.__BetterLooksmaxFramework) {
  // Framework already exists (content script re-injected?)
  framework = window.__BetterLooksmaxFramework;
} else {
  // Create new framework
  framework = new FrameworkCore();
  
  // Expose immediately
  if (typeof window !== 'undefined') {
    window.__BetterLooksmaxFramework = framework;
  }
  
  // Initialize once
  const initOnce = () => {
    framework.init().catch(error => {
      console.error('[Framework] Initialization failed:', error);
    });
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnce, { once: true });
  } else {
    initOnce();
  }
}

export default framework;
