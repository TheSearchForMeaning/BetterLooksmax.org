/**
 * HookSystem - Event-driven communication system
 * 
 * Provides a priority-based event emitter that allows plugins to register
 * handlers for various lifecycle and application events.
 */

class HookSystem {
  constructor() {
    // Map of hook name to array of handlers
    this.hooks = new Map();
    // Track plugin registrations for cleanup
    this.pluginHooks = new Map();
  }

  /**
   * Register a hook handler
   * @param {string} hookName - Name of the hook (e.g., 'dom:ready')
   * @param {Function} handler - Async function to call when hook fires
   * @param {object} options - Configuration options
   * @param {number} options.priority - Execution order (0-100, lower runs first)
   * @param {boolean} options.once - Run only once then unregister
   * @param {string} options.plugin - Plugin ID for tracking
   * @returns {Function} Unregister function
   */
  register(hookName, handler, options = {}) {
    const {
      priority = 50,
      once = false,
      plugin = null
    } = options;

    if (typeof handler !== 'function') {
      throw new Error(`Handler for hook '${hookName}' must be a function`);
    }

    // Create handler entry
    const entry = {
      handler,
      priority,
      once,
      plugin,
      id: Symbol('handler')
    };

    // Get or create handlers array for this hook
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    const handlers = this.hooks.get(hookName);
    handlers.push(entry);

    // Sort by priority (lower priority runs first)
    handlers.sort((a, b) => a.priority - b.priority);

    // Track for plugin cleanup
    if (plugin) {
      if (!this.pluginHooks.has(plugin)) {
        this.pluginHooks.set(plugin, []);
      }
      this.pluginHooks.get(plugin).push({ hookName, id: entry.id });
    }

    // Return unregister function
    return () => this._unregister(hookName, entry.id);
  }

  /**
   * Internal unregister by handler ID
   */
  _unregister(hookName, handlerId) {
    const handlers = this.hooks.get(hookName);
    if (!handlers) return;

    const index = handlers.findIndex(h => h.id === handlerId);
    if (index !== -1) {
      const removed = handlers.splice(index, 1)[0];
      
      // Clean up plugin tracking
      if (removed.plugin) {
        const pluginHookList = this.pluginHooks.get(removed.plugin);
        if (pluginHookList) {
          const idx = pluginHookList.findIndex(
            h => h.hookName === hookName && h.id === handlerId
          );
          if (idx !== -1) {
            pluginHookList.splice(idx, 1);
          }
        }
      }
    }

    // Clean up empty hook arrays
    if (handlers.length === 0) {
      this.hooks.delete(hookName);
    }
  }

  /**
   * Unregister a specific handler
   * @param {string} hookName - Hook name
   * @param {Function} handler - Handler function to remove
   */
  unregister(hookName, handler) {
    const handlers = this.hooks.get(hookName);
    if (!handlers) return;

    const index = handlers.findIndex(h => h.handler === handler);
    if (index !== -1) {
      this._unregister(hookName, handlers[index].id);
    }
  }

  /**
   * Unregister all hooks for a plugin
   * @param {string} pluginId - Plugin ID
   */
  unregisterPlugin(pluginId) {
    const pluginHookList = this.pluginHooks.get(pluginId);
    if (!pluginHookList) return;

    // Unregister all hooks for this plugin
    pluginHookList.forEach(({ hookName, id }) => {
      this._unregister(hookName, id);
    });

    this.pluginHooks.delete(pluginId);
  }

  /**
   * Emit a hook event
   * @param {string} hookName - Hook name to emit
   * @param {*} data - Data to pass to handlers
   * @param {object} options - Emission options
   * @param {boolean} options.parallel - Run handlers in parallel (default: true)
   * @param {boolean} options.cancelable - Allow handlers to cancel propagation
   * @returns {Promise<object>} Result with data and cancelled status
   */
  async emit(hookName, data = null, options = {}) {
    const {
      parallel = true,
      cancelable = false
    } = options;

    const handlers = this.hooks.get(hookName);
    if (!handlers || handlers.length === 0) {
      return { data, cancelled: false };
    }

    let currentData = data;
    let cancelled = false;
    const handlersToRemove = [];

    // Group handlers by priority
    const priorityGroups = this._groupByPriority(handlers);

    try {
      // Execute each priority group sequentially
      for (const group of priorityGroups) {
        if (cancelled && cancelable) break;

        // Create context object for handlers
        const context = {
          data: currentData,
          cancel: () => {
            if (cancelable) cancelled = true;
          }
        };

        if (parallel) {
          // Run handlers in this priority group in parallel
          const results = await Promise.allSettled(
            group.map(entry => this._executeHandler(entry, context))
          );

          // Check for errors
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.error(
                `Error in hook '${hookName}' handler (plugin: ${group[index].plugin}):`,
                result.reason
              );
            }
            
            // Mark once handlers for removal
            if (group[index].once) {
              handlersToRemove.push({ hookName, id: group[index].id });
            }
          });

          // For filter hooks, use the last successful result
          const lastSuccess = results
            .filter(r => r.status === 'fulfilled' && r.value !== undefined)
            .pop();
          
          if (lastSuccess) {
            currentData = lastSuccess.value;
          }
        } else {
          // Run handlers in this priority group sequentially
          for (const entry of group) {
            if (cancelled && cancelable) break;

            try {
              const result = await this._executeHandler(entry, context);
              if (result !== undefined) {
                currentData = result;
              }

              if (entry.once) {
                handlersToRemove.push({ hookName, id: entry.id });
              }
            } catch (error) {
              console.error(
                `Error in hook '${hookName}' handler (plugin: ${entry.plugin}):`,
                error
              );
            }
          }
        }
      }
    } finally {
      // Remove once handlers
      handlersToRemove.forEach(({ hookName, id }) => {
        this._unregister(hookName, id);
      });
    }

    return { data: currentData, cancelled };
  }

  /**
   * Execute a single handler
   */
  async _executeHandler(entry, context) {
    const result = await entry.handler(context);
    return result;
  }

  /**
   * Group handlers by priority for sequential execution
   */
  _groupByPriority(handlers) {
    const groups = new Map();
    
    handlers.forEach(handler => {
      if (!groups.has(handler.priority)) {
        groups.set(handler.priority, []);
      }
      groups.get(handler.priority).push(handler);
    });

    // Return sorted priority groups
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([, handlers]) => handlers);
  }

  /**
   * Check if a hook has any handlers
   * @param {string} hookName - Hook name
   * @returns {boolean}
   */
  hasHandlers(hookName) {
    const handlers = this.hooks.get(hookName);
    return handlers && handlers.length > 0;
  }

  /**
   * Get count of handlers for a hook
   * @param {string} hookName - Hook name
   * @returns {number}
   */
  getHandlerCount(hookName) {
    const handlers = this.hooks.get(hookName);
    return handlers ? handlers.length : 0;
  }

  /**
   * Get all registered hooks
   * @returns {string[]} Array of hook names
   */
  getRegisteredHooks() {
    return Array.from(this.hooks.keys());
  }

  /**
   * Get all hooks for a specific plugin
   * @param {string} pluginId - Plugin ID
   * @returns {object[]} Array of {hookName, id} objects
   */
  getPluginHooks(pluginId) {
    return this.pluginHooks.get(pluginId) || [];
  }

  /**
   * Clear all hooks (useful for testing)
   */
  clear() {
    this.hooks.clear();
    this.pluginHooks.clear();
  }

  /**
   * Create a filter hook that chains transformations
   * Filter hooks pass data through each handler, allowing modification
   * @param {string} hookName - Hook name
   * @param {*} initialData - Initial data to filter
   * @returns {Promise<*>} Filtered data
   */
  async filter(hookName, initialData) {
    const result = await this.emit(hookName, initialData, { parallel: false });
    return result.data;
  }

  /**
   * Create an action hook that doesn't modify data
   * Action hooks notify handlers of an event without expecting return values
   * @param {string} hookName - Hook name
   * @param {*} data - Data to pass to handlers
   * @returns {Promise<void>}
   */
  async action(hookName, data) {
    await this.emit(hookName, data, { parallel: true });
  }
}

// Export singleton instance
export default new HookSystem();
