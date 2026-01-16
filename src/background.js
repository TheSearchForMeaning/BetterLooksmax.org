/**
 * Background Worker - Persistent background process
 * 
 * Maintains persistent state, handles cross-tab synchronization,
 * and processes IPC requests.
 */

import StorageAdapter from './core/StorageAdapter.js';
import IPCManager from './core/IPCManager.js';
import Logger from '../utils/logger.js';

class BackgroundService {
  constructor() {
    this.logger = Logger.child('Background');
    this.storage = StorageAdapter;
    this.ipc = IPCManager;
    
    // Track active tabs
    this.activeTabs = new Map();
    
    // Framework state
    this.state = {
      initialized: false,
      version: '1.0.0'
    };
  }

  /**
   * Initialize background service
   */
  async init() {
    if (this.state.initialized) {
      this.logger.warn('Background service already initialized');
      return;
    }

    try {
      this.logger.info('Initializing background service...');

      // Setup IPC handlers
      this._setupIPCHandlers();

      // Setup browser action handlers
      this._setupBrowserActionHandlers();

      // Setup tab tracking
      this._setupTabTracking();

      // Setup storage sync
      this._setupStorageSync();

      this.state.initialized = true;
      this.logger.info('Background service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize background service:', error);
      throw error;
    }
  }

  /**
   * Setup IPC message handlers
   */
  _setupIPCHandlers() {
    // Relay plugin commands to content scripts
    this.ipc.on('plugin:enable', async (data, sender) => {
      const { pluginId } = data;
      this.logger.info(`Relaying enable request for plugin: ${pluginId}`);
      
      // Broadcast to all tabs
      await this.ipc.broadcast('plugin:enable', { pluginId });
      
      return { success: true };
    });

    this.ipc.on('plugin:disable', async (data, sender) => {
      const { pluginId } = data;
      this.logger.info(`Relaying disable request for plugin: ${pluginId}`);
      
      // Broadcast to all tabs
      await this.ipc.broadcast('plugin:disable', { pluginId });
      
      return { success: true };
    });

    // Handle settings sync
    this.ipc.on('settings:sync', async (data, sender) => {
      this.logger.info('Syncing settings across tabs');
      
      // Broadcast settings change to all tabs except sender
      const tabs = await this.ipc.getAllTabs();
      tabs.forEach(tab => {
        if (tab.id !== sender.tab?.id) {
          this.ipc.sendToTab(tab.id, 'settings:changed', data).catch(() => {
            // Ignore errors for tabs that can't receive messages
          });
        }
      });
      
      return { success: true };
    });

    // Handle get state request
    this.ipc.on('background:getState', async () => {
      return this.state;
    });
  }

  /**
   * Setup browser action (extension icon) handlers
   */
  _setupBrowserActionHandlers() {
    if (!chrome?.action) return;

    // Update badge when plugins change state
    this.ipc.on('plugin:enabled', async (data) => {
      const { pluginId } = data;
      await this._updateBadge();
    });

    this.ipc.on('plugin:disabled', async (data) => {
      const { pluginId } = data;
      await this._updateBadge();
    });
  }

  /**
   * Update extension icon badge
   */
  async _updateBadge() {
    if (!chrome?.action) return;

    try {
      const settings = await this.storage.get('settings');
      if (settings.settings?.plugins) {
        const enabledCount = Object.values(settings.settings.plugins)
          .filter(p => p.enabled).length;
        
        if (enabledCount > 0) {
          await chrome.action.setBadgeText({ text: enabledCount.toString() });
          await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        } else {
          await chrome.action.setBadgeText({ text: '' });
        }
      }
    } catch (error) {
      this.logger.error('Failed to update badge:', error);
    }
  }

  /**
   * Setup tab tracking
   */
  _setupTabTracking() {
    if (!chrome?.tabs) return;

    // Track when tabs are created
    chrome.tabs.onCreated.addListener((tab) => {
      this.activeTabs.set(tab.id, {
        id: tab.id,
        url: tab.url,
        created: Date.now()
      });
      this.logger.debug(`Tab created: ${tab.id}`);
    });

    // Track when tabs are updated
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.activeTabs.set(tabId, {
          id: tabId,
          url: tab.url,
          updated: Date.now()
        });
        this.logger.debug(`Tab updated: ${tabId}`);
      }
    });

    // Clean up when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.activeTabs.delete(tabId);
      this.logger.debug(`Tab removed: ${tabId}`);
    });
  }

  /**
   * Setup storage synchronization
   */
  _setupStorageSync() {
    // Listen for storage changes
    this.storage.onChanged((changes) => {
      this.logger.debug('Storage changed:', Object.keys(changes));
      
      // Broadcast storage changes to all tabs
      this.ipc.broadcast('storage:changed', changes).catch(error => {
        this.logger.error('Failed to broadcast storage changes:', error);
      });
    });
  }

  /**
   * Get active tab count
   * @returns {number} Number of active tabs
   */
  getActiveTabCount() {
    return this.activeTabs.size;
  }

  /**
   * Get all active tabs
   * @returns {Array} Array of tab info
   */
  getActiveTabs() {
    return Array.from(this.activeTabs.values());
  }

  /**
   * Clear expired tab entries
   */
  cleanupTabs() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    this.activeTabs.forEach((info, tabId) => {
      if (info.updated && now - info.updated > maxAge) {
        this.activeTabs.delete(tabId);
      }
    });
  }

  /**
   * Get service statistics
   * @returns {object} Service stats
   */
  getStats() {
    return {
      ...this.state,
      activeTabs: this.activeTabs.size,
      ipc: this.ipc.getStats()
    };
  }
}

// Create and initialize service
const service = new BackgroundService();

// Initialize immediately
service.init().catch(error => {
  console.error('[Background] Initialization failed:', error);
});

// Cleanup tabs periodically
setInterval(() => {
  service.cleanupTabs();
}, 60 * 60 * 1000); // Every hour

// Handle extension install/update
if (chrome?.runtime) {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('[Background] Extension installed');
      // Could open welcome page here
    } else if (details.reason === 'update') {
      console.log('[Background] Extension updated');
      // Could handle migration here
    }
  });
}

// Expose service for debugging
if (typeof self !== 'undefined') {
  self.__BetterLooksmaxBackground = service;
}

export default service;
