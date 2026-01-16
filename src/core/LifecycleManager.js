/**
 * LifecycleManager - Plugin lifecycle state machine
 * 
 * Controls plugin lifecycle (init → start → stop → destroy),
 * handles enable/disable operations, and provides error recovery.
 */

import PluginRegistry from './PluginRegistry.js';
import HookSystem from './HookSystem.js';
import SettingsStore from './SettingsStore.js';

class LifecycleManager {
  constructor() {
    this.registry = PluginRegistry;
    this.hooks = HookSystem;
    this.settings = SettingsStore;
    
    // Track state snapshots for rollback
    this.stateSnapshots = new Map();
  }

  /**
   * Initialize a plugin (one-time setup)
   * @param {string} pluginId - Plugin ID
   * @param {object} api - Plugin API object
   * @returns {Promise<boolean>} Success status
   */
  async initPlugin(pluginId, api) {
    const state = this.registry.getState(pluginId);
    
    if (state !== this.registry.STATES.LOADED) {
      throw new Error(
        `Plugin ${pluginId} must be in LOADED state to initialize (current: ${state})`
      );
    }

    const instance = this.registry.getInstance(pluginId);
    if (!instance) {
      throw new Error(`Plugin instance not found: ${pluginId}`);
    }

    try {
      // Run init if it exists
      if (typeof instance.init === 'function') {
        await instance.init(api);
      }

      return true;
    } catch (error) {
      console.error(`[LifecycleManager] Failed to initialize ${pluginId}:`, error);
      this.registry.setError(pluginId, error);
      return false;
    }
  }

  /**
   * Start a plugin (enable it)
   * @param {string} pluginId - Plugin ID
   * @param {object} api - Plugin API object
   * @returns {Promise<boolean>} Success status
   */
  async startPlugin(pluginId, api) {
    const state = this.registry.getState(pluginId);
    
    if (state === this.registry.STATES.ACTIVE) {
      return true; // Already active
    }

    if (state !== this.registry.STATES.LOADED && state !== this.registry.STATES.STOPPED) {
      throw new Error(
        `Plugin ${pluginId} must be in LOADED or STOPPED state to start (current: ${state})`
      );
    }

    // Check dependencies
    const depCheck = this.registry.checkDependencies(pluginId);
    if (!depCheck.met) {
      throw new Error(
        `Cannot start ${pluginId}: missing dependencies ${depCheck.missing.join(', ')}`
      );
    }

    // Check conflicts
    const conflictCheck = this.registry.checkConflicts(pluginId);
    if (conflictCheck.conflicts) {
      throw new Error(
        `Cannot start ${pluginId}: conflicts with ${conflictCheck.conflicting.join(', ')}`
      );
    }

    const instance = this.registry.getInstance(pluginId);
    if (!instance) {
      throw new Error(`Plugin instance not found: ${pluginId}`);
    }

    try {
      // Take snapshot for rollback
      this._takeSnapshot(pluginId);

      this.registry.setState(pluginId, this.registry.STATES.STARTING);
      
      // Emit before-enable hook
      await this.hooks.action('plugin:before-enable', { pluginId });

      // Register plugin's hooks if defined
      if (instance.hooks) {
        this._registerPluginHooks(pluginId, instance.hooks, api);
      }

      // Register plugin's settings schema if defined
      if (instance.settings) {
        this.settings.registerSchema(pluginId, instance.settings);
      }

      // Run start lifecycle method
      if (typeof instance.start === 'function') {
        await instance.start(api);
      }

      this.registry.setState(pluginId, this.registry.STATES.ACTIVE);
      this.registry.clearError(pluginId);
      
      // DON'T update settings here - that's the framework's job
      // This method only manages runtime state

      // Emit enabled hook
      await this.hooks.action('plugin:enabled', { pluginId });

      return true;
    } catch (error) {
      console.error(`[LifecycleManager] Failed to start ${pluginId}:`, error);
      
      // Rollback
      await this._rollback(pluginId, api);
      
      this.registry.setError(pluginId, error);
      await this.hooks.action('plugin:error', { pluginId, error });
      
      return false;
    }
  }

  /**
   * Stop a plugin (disable it)
   * @param {string} pluginId - Plugin ID
   * @param {object} api - Plugin API object
   * @returns {Promise<boolean>} Success status
   */
  async stopPlugin(pluginId, api) {
    const state = this.registry.getState(pluginId);
    
    if (state === this.registry.STATES.STOPPED) {
      return true; // Already stopped
    }

    if (state !== this.registry.STATES.ACTIVE) {
      throw new Error(
        `Plugin ${pluginId} must be in ACTIVE state to stop (current: ${state})`
      );
    }

    // Check if any active plugins depend on this one
    const dependents = this.registry.getDependents(pluginId);
    const activeDependents = dependents.filter(depId => 
      this.registry.getState(depId) === this.registry.STATES.ACTIVE
    );

    if (activeDependents.length > 0) {
      throw new Error(
        `Cannot stop ${pluginId}: required by ${activeDependents.join(', ')}`
      );
    }

    const instance = this.registry.getInstance(pluginId);
    if (!instance) {
      throw new Error(`Plugin instance not found: ${pluginId}`);
    }

    try {
      this.registry.setState(pluginId, this.registry.STATES.STOPPING);
      
      // Emit before-disable hook
      await this.hooks.action('plugin:before-disable', { pluginId });

      // Run stop lifecycle method
      if (typeof instance.stop === 'function') {
        await instance.stop(api);
      }

      // Unregister all plugin hooks
      this.hooks.unregisterPlugin(pluginId);

      this.registry.setState(pluginId, this.registry.STATES.STOPPED);
      
      // DON'T update settings here - that's the framework's job
      // This method only manages runtime state
      
      // Emit disabled hook
      await this.hooks.action('plugin:disabled', { pluginId });

      return true;
    } catch (error) {
      console.error(`[LifecycleManager] Failed to stop ${pluginId}:`, error);
      this.registry.setError(pluginId, error);
      return false;
    }
  }

  /**
   * Destroy a plugin (cleanup)
   * @param {string} pluginId - Plugin ID
   * @param {object} api - Plugin API object
   * @returns {Promise<boolean>} Success status
   */
  async destroyPlugin(pluginId, api) {
    const state = this.registry.getState(pluginId);
    
    // Must be stopped first
    if (state === this.registry.STATES.ACTIVE) {
      await this.stopPlugin(pluginId, api);
    }

    const instance = this.registry.getInstance(pluginId);
    if (!instance) {
      return true; // Already destroyed
    }

    try {
      // Run destroy lifecycle method
      if (typeof instance.destroy === 'function') {
        await instance.destroy(api);
      }

      this.registry.setState(pluginId, this.registry.STATES.DESTROYED);
      
      return true;
    } catch (error) {
      console.error(`[LifecycleManager] Failed to destroy ${pluginId}:`, error);
      this.registry.setError(pluginId, error);
      return false;
    }
  }

  /**
   * Enable a plugin (load if needed, then start)
   * @param {string} pluginId - Plugin ID
   * @param {object} api - Plugin API object
   * @returns {Promise<boolean>} Success status
   */
  async enablePlugin(pluginId, api) {
    const state = this.registry.getState(pluginId);

    // If already active, nothing to do
    if (state === this.registry.STATES.ACTIVE) {
      return true;
    }

    // If loaded or stopped, just start
    if (state === this.registry.STATES.LOADED || state === this.registry.STATES.STOPPED) {
      return await this.startPlugin(pluginId, api);
    }

    throw new Error(
      `Plugin ${pluginId} is in invalid state for enabling: ${state}`
    );
  }

  /**
   * Disable a plugin
   * @param {string} pluginId - Plugin ID
   * @param {object} api - Plugin API object
   * @returns {Promise<boolean>} Success status
   */
  async disablePlugin(pluginId, api) {
    return await this.stopPlugin(pluginId, api);
  }

  /**
   * Reload a plugin (stop and start)
   * @param {string} pluginId - Plugin ID
   * @param {object} api - Plugin API object
   * @returns {Promise<boolean>} Success status
   */
  async reloadPlugin(pluginId, api) {
    const wasActive = this.registry.getState(pluginId) === this.registry.STATES.ACTIVE;
    
    if (wasActive) {
      await this.stopPlugin(pluginId, api);
    }

    // Could also reload the module here in dev mode
    
    if (wasActive) {
      return await this.startPlugin(pluginId, api);
    }

    return true;
  }

  /**
   * Register plugin's hooks
   */
  _registerPluginHooks(pluginId, hooks, api) {
    Object.entries(hooks).forEach(([hookName, handler]) => {
      this.hooks.register(hookName, async (context) => {
        // Provide API to hook handlers
        return await handler.call(null, context, api);
      }, {
        plugin: pluginId,
        priority: 50
      });
    });
  }

  /**
   * Take a state snapshot for rollback
   */
  _takeSnapshot(pluginId) {
    const snapshot = {
      state: this.registry.getState(pluginId),
      hooks: this.hooks.getPluginHooks(pluginId).length,
      timestamp: Date.now()
    };
    
    this.stateSnapshots.set(pluginId, snapshot);
  }

  /**
   * Rollback to previous state on error
   */
  async _rollback(pluginId, api) {
    const snapshot = this.stateSnapshots.get(pluginId);
    if (!snapshot) return;

    try {
      // Unregister any hooks that were registered
      this.hooks.unregisterPlugin(pluginId);
      
      // Restore state
      this.registry.setState(pluginId, snapshot.state);
      
      this.stateSnapshots.delete(pluginId);
    } catch (error) {
      console.error(`[LifecycleManager] Rollback failed for ${pluginId}:`, error);
    }
  }

  /**
   * Handle plugin error during runtime
   * @param {string} pluginId - Plugin ID
   * @param {Error} error - Error that occurred
   * @param {object} api - Plugin API object
   */
  async handleError(pluginId, error, api) {
    console.error(`[LifecycleManager] Runtime error in ${pluginId}:`, error);
    
    this.registry.setError(pluginId, error);
    await this.hooks.action('plugin:error', { pluginId, error });

    // Optionally stop the plugin on error
    const state = this.registry.getState(pluginId);
    if (state === this.registry.STATES.ACTIVE) {
      try {
        await this.stopPlugin(pluginId, api);
      } catch (stopError) {
        console.error(`[LifecycleManager] Failed to stop errored plugin ${pluginId}:`, stopError);
      }
    }
  }

  /**
   * Get lifecycle statistics
   * @returns {object} Lifecycle stats
   */
  getStats() {
    return {
      snapshots: this.stateSnapshots.size,
      states: this.registry.getStats()
    };
  }

  /**
   * Clear lifecycle manager state
   */
  clear() {
    this.stateSnapshots.clear();
  }
}

// Export singleton instance
export default new LifecycleManager();
