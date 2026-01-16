/**
 * PluginLoader - Plugin discovery and loading system
 * 
 * Discovers plugins, resolves dependencies, determines load order,
 * and handles plugin module loading.
 */

import PluginRegistry from './PluginRegistry.js';

class PluginLoader {
  constructor() {
    this.registry = PluginRegistry;
    this.pluginModules = new Map();
    this.loadedPaths = new Set();
  }

  /**
   * Discover all available plugins
   * @returns {Promise<string[]>} Array of discovered plugin IDs
   */
  async discoverPlugins() {
    // Get list of plugin directories
    const pluginList = await this._getPluginList();
    const discovered = [];

    for (const pluginPath of pluginList) {
      try {
        const manifest = await this._loadManifest(pluginPath);
        if (this._validateManifest(manifest)) {
          this.registry.register(manifest);
          this.pluginModules.set(manifest.id, { path: pluginPath, loaded: false });
          discovered.push(manifest.id);
        }
      } catch (error) {
        console.error(`[PluginLoader] Failed to load manifest for ${pluginPath}:`, error);
      }
    }

    return discovered;
  }

  /**
   * Get list of plugin paths to load
   * Dynamically loads from plugins registry
   */
  async _getPluginList() {
    try {
      // Load plugin registry from plugins.json
      const registryUrl = chrome.runtime.getURL('plugins/plugins.json');
      const response = await fetch(registryUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to load plugin registry: ${response.status}`);
      }
      
      const registry = await response.json();
      
      // Filter enabled plugins and return their paths
      const enabledPlugins = registry.plugins
        .filter(plugin => plugin.enabled !== false)
        .map(plugin => plugin.path);
      
      console.log(`[PluginLoader] Discovered ${enabledPlugins.length} plugins from registry`);
      return enabledPlugins;
      
    } catch (error) {
      console.error('[PluginLoader] Failed to load plugin registry:', error);
      // Fallback to empty array if registry fails
      return [];
    }
  }

  /**
   * Load plugin manifest file
   * @param {string} pluginPath - Path to plugin directory
   * @returns {Promise<object>} Plugin manifest
   */
  async _loadManifest(pluginPath) {
    try {
      // Try to load index.js as the plugin module
      const modulePath = `/${pluginPath}/index.js`;
      const module = await import(modulePath);
      
      // Plugin should export default manifest
      if (module.default) {
        return module.default;
      }
      
      throw new Error('Plugin module must export default manifest');
    } catch (error) {
      throw new Error(`Failed to load plugin from ${pluginPath}: ${error.message}`);
    }
  }

  /**
   * Validate plugin manifest structure
   * @param {object} manifest - Plugin manifest to validate
   * @returns {boolean} Is valid
   */
  _validateManifest(manifest) {
    const required = ['id', 'name', 'version', 'description'];
    
    for (const field of required) {
      if (!manifest[field]) {
        console.error(`[PluginLoader] Plugin manifest missing required field: ${field}`);
        return false;
      }
    }

    // Validate ID format (alphanumeric, hyphens, underscores)
    if (!/^[a-z0-9-_]+$/i.test(manifest.id)) {
      console.error(`[PluginLoader] Invalid plugin ID format: ${manifest.id}`);
      return false;
    }

    // Validate version format (semver-like)
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      console.error(`[PluginLoader] Invalid version format for ${manifest.id}: ${manifest.version}`);
      return false;
    }

    return true;
  }

  /**
   * Resolve load order based on dependencies
   * Uses topological sort to determine correct initialization sequence
   * @param {string[]} pluginIds - Array of plugin IDs to load
   * @returns {string[]} Sorted array of plugin IDs
   */
  resolveLoadOrder(pluginIds) {
    const graph = new Map();
    const inDegree = new Map();

    // Build graph and calculate in-degrees
    pluginIds.forEach(id => {
      graph.set(id, []);
      inDegree.set(id, 0);
    });

    // Build edges (dependency -> dependent)
    pluginIds.forEach(id => {
      const deps = this.registry.getDependencies(id);
      deps.forEach(depId => {
        if (pluginIds.includes(depId)) {
          if (!graph.has(depId)) {
            graph.set(depId, []);
          }
          graph.get(depId).push(id);
          inDegree.set(id, (inDegree.get(id) || 0) + 1);
        }
      });
    });

    // Kahn's algorithm for topological sort
    const queue = [];
    const result = [];

    // Start with nodes that have no dependencies
    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      const neighbors = graph.get(current) || [];
      neighbors.forEach(neighbor => {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Check for circular dependencies
    if (result.length !== pluginIds.length) {
      const missing = pluginIds.filter(id => !result.includes(id));
      throw new Error(`Circular dependency detected in plugins: ${missing.join(', ')}`);
    }

    return result;
  }

  /**
   * Load a plugin module
   * @param {string} pluginId - Plugin ID to load
   * @returns {Promise<object>} Plugin instance/manifest
   */
  async loadPlugin(pluginId) {
    const pluginInfo = this.pluginModules.get(pluginId);
    
    if (!pluginInfo) {
      throw new Error(`Plugin ${pluginId} not found in discovered plugins`);
    }

    if (pluginInfo.loaded) {
      return this.registry.getInstance(pluginId);
    }

    try {
      // Check dependencies are loaded
      const depCheck = this.registry.checkDependencies(pluginId);
      if (!depCheck.met) {
        throw new Error(
          `Missing required dependencies: ${depCheck.missing.join(', ')}`
        );
      }

      // Check for conflicts
      const conflictCheck = this.registry.checkConflicts(pluginId);
      if (conflictCheck.conflicts) {
        throw new Error(
          `Conflicts with active plugins: ${conflictCheck.conflicting.join(', ')}`
        );
      }

      this.registry.setState(pluginId, this.registry.STATES.LOADING);

      // Load the module (it's already imported during discovery)
      const modulePath = `/${pluginInfo.path}/index.js`;
      const module = await import(modulePath);
      const manifest = module.default;

      // Store instance (the manifest itself contains lifecycle methods)
      this.registry.setInstance(pluginId, manifest);
      pluginInfo.loaded = true;
      this.loadedPaths.add(modulePath);

      this.registry.setState(pluginId, this.registry.STATES.LOADED);

      return manifest;
    } catch (error) {
      this.registry.setError(pluginId, error);
      throw error;
    }
  }

  /**
   * Load multiple plugins in correct order
   * @param {string[]} pluginIds - Array of plugin IDs to load
   * @returns {Promise<object[]>} Array of loaded plugin instances
   */
  async loadPlugins(pluginIds) {
    // Resolve correct load order
    const loadOrder = this.resolveLoadOrder(pluginIds);
    const loaded = [];

    for (const pluginId of loadOrder) {
      try {
        const instance = await this.loadPlugin(pluginId);
        loaded.push(instance);
      } catch (error) {
        console.error(`[PluginLoader] Failed to load plugin ${pluginId}:`, error);
        // Continue loading other plugins
      }
    }

    return loaded;
  }

  /**
   * Reload a plugin (for hot-reload in dev mode)
   * @param {string} pluginId - Plugin ID to reload
   * @returns {Promise<object>} Reloaded plugin instance
   */
  async reloadPlugin(pluginId) {
    const pluginInfo = this.pluginModules.get(pluginId);
    
    if (!pluginInfo) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Mark as not loaded to force reimport
    pluginInfo.loaded = false;
    
    // Clear from loaded paths
    const modulePath = `/${pluginInfo.path}/index.js`;
    this.loadedPaths.delete(modulePath);

    // Note: True hot reload would require cache busting
    // For now, this marks it for reload on next load attempt
    
    return await this.loadPlugin(pluginId);
  }

  /**
   * Unload a plugin
   * @param {string} pluginId - Plugin ID to unload
   */
  unloadPlugin(pluginId) {
    const pluginInfo = this.pluginModules.get(pluginId);
    
    if (pluginInfo) {
      pluginInfo.loaded = false;
      const modulePath = `/${pluginInfo.path}/index.js`;
      this.loadedPaths.delete(modulePath);
    }

    // Note: We don't remove from registry to preserve metadata
    this.registry.setState(pluginId, this.registry.STATES.UNLOADED);
  }

  /**
   * Get dependency tree for a plugin
   * @param {string} pluginId - Plugin ID
   * @param {Set} visited - Set of visited plugins (for cycle detection)
   * @returns {object} Dependency tree
   */
  getDependencyTree(pluginId, visited = new Set()) {
    if (visited.has(pluginId)) {
      return { id: pluginId, circular: true };
    }

    visited.add(pluginId);

    const manifest = this.registry.getManifest(pluginId);
    if (!manifest) {
      return { id: pluginId, error: 'Not found' };
    }

    const dependencies = this.registry.getDependencies(pluginId);
    const tree = {
      id: pluginId,
      name: manifest.name,
      version: manifest.version,
      state: this.registry.getState(pluginId),
      dependencies: dependencies.map(depId => 
        this.getDependencyTree(depId, new Set(visited))
      )
    };

    return tree;
  }

  /**
   * Get all loaded plugin IDs
   * @returns {string[]} Array of loaded plugin IDs
   */
  getLoadedPlugins() {
    const loaded = [];
    this.pluginModules.forEach((info, pluginId) => {
      if (info.loaded) {
        loaded.push(pluginId);
      }
    });
    return loaded;
  }

  /**
   * Check if plugin is loaded
   * @param {string} pluginId - Plugin ID
   * @returns {boolean}
   */
  isLoaded(pluginId) {
    const info = this.pluginModules.get(pluginId);
    return info ? info.loaded : false;
  }

  /**
   * Get loader statistics
   * @returns {object} Loader stats
   */
  getStats() {
    return {
      discovered: this.pluginModules.size,
      loaded: this.getLoadedPlugins().length,
      paths: this.loadedPaths.size
    };
  }

  /**
   * Clear loader state (useful for testing)
   */
  clear() {
    this.pluginModules.clear();
    this.loadedPaths.clear();
  }
}

// Export singleton instance
export default new PluginLoader();
