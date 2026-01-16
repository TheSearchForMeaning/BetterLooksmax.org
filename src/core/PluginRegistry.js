/**
 * PluginRegistry - Plugin catalog and state management
 * 
 * Maintains catalog of all plugins with their manifests, instances,
 * states, dependencies, and metadata.
 */

class PluginRegistry {
  constructor() {
    // Plugin states enum
    this.STATES = {
      UNLOADED: 'UNLOADED',
      LOADING: 'LOADING',
      LOADED: 'LOADED',
      STARTING: 'STARTING',
      ACTIVE: 'ACTIVE',
      STOPPING: 'STOPPING',
      STOPPED: 'STOPPED',
      ERROR: 'ERROR',
      DESTROYED: 'DESTROYED'
    };

    // Maps for plugin data
    this.manifests = new Map();      // pluginId -> manifest
    this.instances = new Map();      // pluginId -> plugin instance
    this.states = new Map();         // pluginId -> current state
    this.errors = new Map();         // pluginId -> error info
    this.metadata = new Map();       // pluginId -> additional metadata
    
    // Dependency graph (adjacency list)
    this.dependencies = new Map();   // pluginId -> [dependent plugin IDs]
    this.dependents = new Map();     // pluginId -> [plugins that depend on this]
  }

  /**
   * Register a plugin manifest
   * @param {object} manifest - Plugin manifest
   */
  register(manifest) {
    const { id } = manifest;
    
    if (!id) {
      throw new Error('Plugin manifest must have an id');
    }

    if (this.manifests.has(id)) {
      console.warn(`[PluginRegistry] Plugin ${id} is already registered`);
      return;
    }

    this.manifests.set(id, manifest);
    this.states.set(id, this.STATES.UNLOADED);
    
    // Build dependency graph
    this._buildDependencies(manifest);
    
    // Initialize metadata
    this.metadata.set(id, {
      registeredAt: Date.now(),
      loadTime: null,
      lastError: null
    });
  }

  /**
   * Build dependency relationships
   */
  _buildDependencies(manifest) {
    const { id, dependencies = [], optionalDependencies = [] } = manifest;
    
    // Store all dependencies (required and optional)
    const allDeps = [...dependencies, ...optionalDependencies];
    this.dependencies.set(id, allDeps);
    
    // Update dependents map
    allDeps.forEach(depId => {
      if (!this.dependents.has(depId)) {
        this.dependents.set(depId, []);
      }
      this.dependents.get(depId).push(id);
    });
  }

  /**
   * Unregister a plugin
   * @param {string} pluginId - Plugin ID
   */
  unregister(pluginId) {
    // Clean up dependencies
    const deps = this.dependencies.get(pluginId) || [];
    deps.forEach(depId => {
      const dependentsList = this.dependents.get(depId);
      if (dependentsList) {
        const index = dependentsList.indexOf(pluginId);
        if (index !== -1) {
          dependentsList.splice(index, 1);
        }
      }
    });

    // Remove from all maps
    this.manifests.delete(pluginId);
    this.instances.delete(pluginId);
    this.states.delete(pluginId);
    this.errors.delete(pluginId);
    this.metadata.delete(pluginId);
    this.dependencies.delete(pluginId);
    this.dependents.delete(pluginId);
  }

  /**
   * Get plugin manifest
   * @param {string} pluginId - Plugin ID
   * @returns {object|null} Plugin manifest
   */
  getManifest(pluginId) {
    return this.manifests.get(pluginId) || null;
  }

  /**
   * Get plugin instance
   * @param {string} pluginId - Plugin ID
   * @returns {object|null} Plugin instance
   */
  getInstance(pluginId) {
    return this.instances.get(pluginId) || null;
  }

  /**
   * Set plugin instance
   * @param {string} pluginId - Plugin ID
   * @param {object} instance - Plugin instance
   */
  setInstance(pluginId, instance) {
    this.instances.set(pluginId, instance);
  }

  /**
   * Get plugin state
   * @param {string} pluginId - Plugin ID
   * @returns {string} Current state
   */
  getState(pluginId) {
    return this.states.get(pluginId) || this.STATES.UNLOADED;
  }

  /**
   * Set plugin state
   * @param {string} pluginId - Plugin ID
   * @param {string} state - New state
   */
  setState(pluginId, state) {
    const oldState = this.getState(pluginId);
    this.states.set(pluginId, state);
    
    // Update metadata
    const meta = this.metadata.get(pluginId);
    if (meta) {
      if (state === this.STATES.ACTIVE && !meta.loadTime) {
        meta.loadTime = Date.now() - meta.registeredAt;
      }
    }
    
    return oldState;
  }

  /**
   * Get plugin error
   * @param {string} pluginId - Plugin ID
   * @returns {Error|null} Last error
   */
  getError(pluginId) {
    return this.errors.get(pluginId) || null;
  }

  /**
   * Set plugin error
   * @param {string} pluginId - Plugin ID
   * @param {Error} error - Error object
   */
  setError(pluginId, error) {
    this.errors.set(pluginId, error);
    this.setState(pluginId, this.STATES.ERROR);
    
    const meta = this.metadata.get(pluginId);
    if (meta) {
      meta.lastError = {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Clear plugin error
   * @param {string} pluginId - Plugin ID
   */
  clearError(pluginId) {
    this.errors.delete(pluginId);
  }

  /**
   * Get all registered plugins
   * @returns {string[]} Array of plugin IDs
   */
  getAllPlugins() {
    return Array.from(this.manifests.keys());
  }

  /**
   * Get plugins by state
   * @param {string} state - State to filter by
   * @returns {string[]} Array of plugin IDs
   */
  getPluginsByState(state) {
    const plugins = [];
    this.states.forEach((pluginState, pluginId) => {
      if (pluginState === state) {
        plugins.push(pluginId);
      }
    });
    return plugins;
  }

  /**
   * Get active plugins
   * @returns {string[]} Array of active plugin IDs
   */
  getActivePlugins() {
    return this.getPluginsByState(this.STATES.ACTIVE);
  }

  /**
   * Get plugins by tag
   * @param {string} tag - Tag to filter by
   * @returns {string[]} Array of plugin IDs
   */
  getPluginsByTag(tag) {
    const plugins = [];
    this.manifests.forEach((manifest, pluginId) => {
      if (manifest.tags && manifest.tags.includes(tag)) {
        plugins.push(pluginId);
      }
    });
    return plugins;
  }

  /**
   * Get plugins by category
   * @param {string} category - Category to filter by
   * @returns {string[]} Array of plugin IDs
   */
  getPluginsByCategory(category) {
    const plugins = [];
    this.manifests.forEach((manifest, pluginId) => {
      if (manifest.category === category) {
        plugins.push(pluginId);
      }
    });
    return plugins;
  }

  /**
   * Get all categories
   * @returns {string[]} Array of unique categories
   */
  getCategories() {
    const categories = new Set();
    this.manifests.forEach(manifest => {
      if (manifest.category) {
        categories.add(manifest.category);
      }
    });
    return Array.from(categories);
  }

  /**
   * Get all tags
   * @returns {string[]} Array of unique tags
   */
  getTags() {
    const tags = new Set();
    this.manifests.forEach(manifest => {
      if (manifest.tags) {
        manifest.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags);
  }

  /**
   * Get dependencies for a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {string[]} Array of dependency plugin IDs
   */
  getDependencies(pluginId) {
    return this.dependencies.get(pluginId) || [];
  }

  /**
   * Get dependents of a plugin (plugins that depend on this one)
   * @param {string} pluginId - Plugin ID
   * @returns {string[]} Array of dependent plugin IDs
   */
  getDependents(pluginId) {
    return this.dependents.get(pluginId) || [];
  }

  /**
   * Check if a plugin has required dependencies met
   * @param {string} pluginId - Plugin ID
   * @returns {object} {met: boolean, missing: string[]}
   */
  checkDependencies(pluginId) {
    const manifest = this.getManifest(pluginId);
    if (!manifest) {
      return { met: false, missing: [] };
    }

    const required = manifest.dependencies || [];
    const missing = [];

    required.forEach(depId => {
      const depState = this.getState(depId);
      if (depState !== this.STATES.ACTIVE) {
        missing.push(depId);
      }
    });

    return {
      met: missing.length === 0,
      missing
    };
  }

  /**
   * Check if a plugin conflicts with any active plugins
   * @param {string} pluginId - Plugin ID
   * @returns {object} {conflicts: boolean, conflicting: string[]}
   */
  checkConflicts(pluginId) {
    const manifest = this.getManifest(pluginId);
    if (!manifest || !manifest.conflicts) {
      return { conflicts: false, conflicting: [] };
    }

    const activePlugins = this.getActivePlugins();
    const conflicting = manifest.conflicts.filter(id => activePlugins.includes(id));

    return {
      conflicts: conflicting.length > 0,
      conflicting
    };
  }

  /**
   * Search plugins by name or description
   * @param {string} query - Search query
   * @returns {string[]} Array of matching plugin IDs
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    const matches = [];

    this.manifests.forEach((manifest, pluginId) => {
      const name = (manifest.name || '').toLowerCase();
      const description = (manifest.description || '').toLowerCase();
      
      if (name.includes(lowerQuery) || description.includes(lowerQuery)) {
        matches.push(pluginId);
      }
    });

    return matches;
  }

  /**
   * Get plugin metadata
   * @param {string} pluginId - Plugin ID
   * @returns {object|null} Plugin metadata
   */
  getMetadata(pluginId) {
    return this.metadata.get(pluginId) || null;
  }

  /**
   * Get plugin info (manifest + state + metadata)
   * @param {string} pluginId - Plugin ID
   * @returns {object|null} Combined plugin information
   */
  getPluginInfo(pluginId) {
    const manifest = this.getManifest(pluginId);
    if (!manifest) return null;

    return {
      ...manifest,
      state: this.getState(pluginId),
      error: this.getError(pluginId),
      metadata: this.getMetadata(pluginId),
      dependencies: this.getDependencies(pluginId),
      dependents: this.getDependents(pluginId)
    };
  }

  /**
   * Get all plugin info
   * @returns {object[]} Array of plugin info objects
   */
  getAllPluginInfo() {
    return this.getAllPlugins().map(id => this.getPluginInfo(id));
  }

  /**
   * Check if plugin exists
   * @param {string} pluginId - Plugin ID
   * @returns {boolean}
   */
  has(pluginId) {
    return this.manifests.has(pluginId);
  }

  /**
   * Get registry statistics
   * @returns {object} Registry stats
   */
  getStats() {
    const stats = {
      total: this.manifests.size,
      byState: {},
      byCategory: {},
      withErrors: 0
    };

    // Count by state
    Object.values(this.STATES).forEach(state => {
      stats.byState[state] = this.getPluginsByState(state).length;
    });

    // Count by category
    this.getCategories().forEach(category => {
      stats.byCategory[category] = this.getPluginsByCategory(category).length;
    });

    // Count errors
    stats.withErrors = this.errors.size;

    return stats;
  }

  /**
   * Clear all registry data (useful for testing)
   */
  clear() {
    this.manifests.clear();
    this.instances.clear();
    this.states.clear();
    this.errors.clear();
    this.metadata.clear();
    this.dependencies.clear();
    this.dependents.clear();
  }
}

// Export singleton instance
export default new PluginRegistry();
