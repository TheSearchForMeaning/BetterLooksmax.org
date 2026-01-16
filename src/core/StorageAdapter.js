/**
 * StorageAdapter - Cross-browser storage abstraction
 * 
 * Provides a unified Promise-based API for browser storage that works
 * across Chrome (chrome.storage) and Firefox (browser.storage).
 */

class StorageAdapter {
  constructor() {
    // Detect browser API
    this.storage = this._getBrowserAPI();
    this.changeListeners = new Set();
    this._setupChangeListener();
  }

  /**
   * Get the appropriate browser storage API
   */
  _getBrowserAPI() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return chrome.storage.local;
    } else if (typeof browser !== 'undefined' && browser.storage) {
      return browser.storage.local;
    } else {
      // Fallback to localStorage wrapper
      return this._createLocalStorageFallback();
    }
  }

  /**
   * Create a localStorage fallback with Promise-based API
   */
  _createLocalStorageFallback() {
    return {
      get: (keys) => {
        return new Promise((resolve) => {
          const result = {};
          const keyArray = Array.isArray(keys) ? keys : [keys];
          
          keyArray.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
              try {
                result[key] = JSON.parse(value);
              } catch (e) {
                result[key] = value;
              }
            }
          });
          
          resolve(result);
        });
      },
      set: (items) => {
        return new Promise((resolve) => {
          Object.entries(items).forEach(([key, value]) => {
            localStorage.setItem(key, JSON.stringify(value));
          });
          resolve();
        });
      },
      remove: (keys) => {
        return new Promise((resolve) => {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach(key => localStorage.removeItem(key));
          resolve();
        });
      },
      clear: () => {
        return new Promise((resolve) => {
          localStorage.clear();
          resolve();
        });
      }
    };
  }

  /**
   * Setup change listener for storage updates
   */
  _setupChangeListener() {
    const handler = (changes, areaName) => {
      if (areaName === 'local') {
        this.changeListeners.forEach(listener => {
          listener(changes);
        });
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener(handler);
    } else if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.onChanged.addListener(handler);
    }
  }

  /**
   * Get value(s) from storage
   * @param {string|string[]|object} keys - Key(s) to retrieve or object with defaults
   * @returns {Promise<object>} Object containing requested key-value pairs
   */
  async get(keys) {
    return new Promise((resolve, reject) => {
      // Handle different key formats
      let queryKeys = keys;
      let defaults = {};

      if (typeof keys === 'object' && !Array.isArray(keys)) {
        // Keys is an object with default values
        defaults = keys;
        queryKeys = Object.keys(keys);
      } else if (typeof keys === 'string') {
        queryKeys = [keys];
      }

      this.storage.get(queryKeys, (result) => {
        if (chrome?.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        // Merge with defaults
        const finalResult = { ...defaults, ...result };
        resolve(finalResult);
      });
    });
  }

  /**
   * Set value(s) in storage
   * @param {object} items - Key-value pairs to store
   * @returns {Promise<void>}
   */
  async set(items) {
    return new Promise((resolve, reject) => {
      this.storage.set(items, () => {
        if (chrome?.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Remove key(s) from storage
   * @param {string|string[]} keys - Key(s) to remove
   * @returns {Promise<void>}
   */
  async remove(keys) {
    return new Promise((resolve, reject) => {
      this.storage.remove(keys, () => {
        if (chrome?.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Clear all data from storage
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise((resolve, reject) => {
      this.storage.clear(() => {
        if (chrome?.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get storage usage information
   * @returns {Promise<{bytesInUse: number, quota: number}>}
   */
  async size() {
    return new Promise((resolve) => {
      if (this.storage.getBytesInUse) {
        this.storage.getBytesInUse(null, (bytesInUse) => {
          // Chrome has a 10MB limit for local storage
          const quota = chrome?.storage?.local?.QUOTA_BYTES || 10485760;
          resolve({ bytesInUse, quota });
        });
      } else {
        // Estimate for localStorage
        let totalSize = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            totalSize += localStorage[key].length + key.length;
          }
        }
        resolve({ bytesInUse: totalSize, quota: 5242880 }); // 5MB estimate
      }
    });
  }

  /**
   * Register a change listener
   * @param {Function} callback - Called when storage changes
   * @returns {Function} Unsubscribe function
   */
  onChanged(callback) {
    this.changeListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  /**
   * Create a namespaced storage interface for a plugin
   * @param {string} namespace - Plugin ID to namespace storage
   * @returns {object} Namespaced storage interface
   */
  namespace(namespace) {
    return {
      get: async (key) => {
        const namespacedKey = `${namespace}.${key}`;
        const result = await this.get(namespacedKey);
        return result[namespacedKey];
      },
      set: async (key, value) => {
        const namespacedKey = `${namespace}.${key}`;
        await this.set({ [namespacedKey]: value });
      },
      remove: async (key) => {
        const namespacedKey = `${namespace}.${key}`;
        await this.remove(namespacedKey);
      },
      getAll: async () => {
        const allData = await this.get(null);
        const namespacePrefix = `${namespace}.`;
        const result = {};
        
        Object.entries(allData).forEach(([key, value]) => {
          if (key.startsWith(namespacePrefix)) {
            const shortKey = key.substring(namespacePrefix.length);
            result[shortKey] = value;
          }
        });
        
        return result;
      }
    };
  }
}

// Export singleton instance
export default new StorageAdapter();
