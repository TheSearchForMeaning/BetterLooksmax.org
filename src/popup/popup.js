/**
 * Popup JavaScript - Settings UI Logic
 * 
 * Handles popup interface, plugin management, and settings updates.
 */

import IPCManager from '../core/IPCManager.js';
import UIGenerator from '../core/UIGenerator.js';
import SettingsStore from '../core/SettingsStore.js';

class PopupUI {
  constructor() {
    this.ipc = IPCManager;
    this.uiGenerator = UIGenerator;
    this.settings = SettingsStore;
    
    this.plugins = [];
    this.currentFilter = 'all';
    this.currentPlugin = null;
    
    this._bindElements();
    this._setupEventListeners();
    this.init();
  }

  /**
   * Bind DOM elements
   */
  _bindElements() {
    // Views
    this.dashboardView = document.getElementById('dashboardView');
    this.settingsView = document.getElementById('settingsView');
    
    // Dashboard elements
    this.searchInput = document.getElementById('searchInput');
    this.pluginGrid = document.getElementById('pluginGrid');
    this.categoryButtons = document.querySelectorAll('.category-btn');
    
    // Settings elements
    this.backBtn = document.getElementById('backBtn');
    this.settingsTitle = document.getElementById('settingsTitle');
    this.settingsContent = document.getElementById('settingsContent');
    this.resetBtn = document.getElementById('resetBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.importBtn = document.getElementById('importBtn');
    
    // Header elements
    this.refreshBtn = document.getElementById('refreshBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    
    // Footer elements
    this.pluginCount = document.getElementById('pluginCount');
    this.enabledCount = document.getElementById('enabledCount');
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Search
    this.searchInput.addEventListener('input', () => {
      this._filterPlugins();
    });
    
    // Category filter
    this.categoryButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this._selectCategory(btn.dataset.category);
      });
    });
    
    // Navigation
    this.backBtn.addEventListener('click', () => {
      this._showDashboard();
    });
    
    // Settings actions
    this.resetBtn.addEventListener('click', () => {
      this._resetSettings();
    });
    
    this.exportBtn.addEventListener('click', () => {
      this._exportSettings();
    });
    
    this.importBtn.addEventListener('click', () => {
      this._importSettings();
    });
    
    // Header actions
    this.refreshBtn.addEventListener('click', () => {
      this.refresh();
    });
  }

  /**
   * Initialize popup
   */
  async init() {
    try {
      // Initialize settings store
      await this.settings.init();
      
      // Load plugins
      await this.loadPlugins();
      
      // Render dashboard
      this._renderDashboard();
      
      // Update footer
      this._updateFooter();
    } catch (error) {
      console.error('[Popup] Initialization failed:', error);
      this.pluginGrid.innerHTML = '<div class="loading">Failed to load plugins</div>';
    }
  }

  /**
   * Load plugins from content script
   */
  async loadPlugins() {
    try {
      console.log('[Popup] Loading plugins...');
      
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        console.warn('[Popup] No active tab found');
        this.pluginGrid.innerHTML = '<div class="loading">No active tab. Open a webpage and try again.</div>';
        this.plugins = [];
        return;
      }
      
      const activeTab = tabs[0];
      console.log('[Popup] Active tab:', activeTab.id, activeTab.url);
      
      // Send message directly to the tab's content script
      this.plugins = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Content script not responding. Try reloading the page.'));
        }, 5000);
        
        chrome.tabs.sendMessage(activeTab.id, {
          type: 'REQUEST',
          action: 'plugins:getAll',
          requestId: Date.now()
        }, (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.error('[Popup] Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error('Content script not loaded. Reload the page.'));
            return;
          }
          
          if (response && response.success) {
            console.log('[Popup] Received', response.data?.length || 0, 'plugins');
            resolve(response.data || []);
          } else {
            console.error('[Popup] Bad response:', response);
            reject(new Error(response?.error || 'Failed to get plugin data'));
          }
        });
      });
      
      console.log('[Popup] Plugins loaded:', this.plugins.length);
    } catch (error) {
      console.error('[Popup] Failed to load plugins:', error);
      this.pluginGrid.innerHTML = `<div class="loading">⚠️ ${error.message}<br><small>Check browser console (F12) for details</small></div>`;
      this.plugins = [];
    }
  }

  /**
   * Refresh plugin list
   */
  async refresh() {
    this.pluginGrid.innerHTML = '<div class="loading">Refreshing...</div>';
    await this.loadPlugins();
    this._renderDashboard();
    this._updateFooter();
  }

  /**
   * Render plugin dashboard
   */
  _renderDashboard() {
    this.pluginGrid.innerHTML = '';
    
    const filtered = this._getFilteredPlugins();
    
    if (filtered.length === 0) {
      this.pluginGrid.innerHTML = '<div class="loading">No plugins found</div>';
      return;
    }
    
    filtered.forEach(plugin => {
      const enabled = this.settings.isEnabled(plugin.id);
      const card = this.uiGenerator.generatePluginCard(
        plugin,
        enabled,
        (pluginId, shouldEnable) => this._togglePlugin(pluginId, shouldEnable),
        (pluginId) => this._showSettings(pluginId)
      );
      this.pluginGrid.appendChild(card);
    });
  }

  /**
   * Get filtered plugins based on search and category
   */
  _getFilteredPlugins() {
    let filtered = this.plugins;
    
    // Filter by category
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(p => p.category === this.currentFilter);
    }
    
    // Filter by search
    const searchTerm = this.searchInput.value.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm)
      );
    }
    
    return filtered;
  }

  /**
   * Filter plugins
   */
  _filterPlugins() {
    this._renderDashboard();
  }

  /**
   * Select category
   */
  _selectCategory(category) {
    this.currentFilter = category;
    
    // Update button states
    this.categoryButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    this._renderDashboard();
  }

  /**
   * Toggle plugin enabled state
   */
  async _togglePlugin(pluginId, shouldEnable) {
    try {
      // Update settings first
      if (shouldEnable) {
        await this.settings.enable(pluginId);
      } else {
        await this.settings.disable(pluginId);
      }
      
      // Notify active tab's content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'EVENT',
          event: shouldEnable ? 'plugin:enable' : 'plugin:disable',
          data: { pluginId }
        });
      }
      
      this._updateFooter();
    } catch (error) {
      console.error(`[Popup] Failed to toggle plugin ${pluginId}:`, error);
      alert(`Failed to ${shouldEnable ? 'enable' : 'disable'} plugin: ${error.message}`);
      
      // Revert toggle
      this.refresh();
    }
  }

  /**
   * Show plugin settings
   */
  async _showSettings(pluginId) {
    this.currentPlugin = this.plugins.find(p => p.id === pluginId);
    if (!this.currentPlugin) return;
    
    // Use the manifest we already have from the plugins list
    const manifest = this.currentPlugin;
    if (!manifest || !manifest.settings) {
      alert('This plugin has no configurable settings');
      return;
    }
    
    // Update title
    this.settingsTitle.textContent = `${this.currentPlugin.name} Settings`;
    
    // Get current values
    const currentValues = this.settings.getAll(pluginId);
    
    // Generate settings panel
    const panel = this.uiGenerator.generateSettingsPanel(
      pluginId,
      manifest.settings,
      currentValues,
      async (key, value) => {
        await this._updateSetting(pluginId, key, value);
      }
    );
    
    // Clear and append
    this.settingsContent.innerHTML = '';
    this.settingsContent.appendChild(panel);
    
    // Show settings view
    this.dashboardView.classList.remove('active');
    this.settingsView.classList.add('active');
  }

  /**
   * Show dashboard
   */
  _showDashboard() {
    this.settingsView.classList.remove('active');
    this.dashboardView.classList.add('active');
    this.currentPlugin = null;
  }

  /**
   * Update a setting
   */
  async _updateSetting(pluginId, key, value) {
    try {
      await this.settings.set(pluginId, key, value);
      
      // Notify active tab's content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'EVENT',
          event: 'settings:change',
          data: { pluginId, key, value }
        });
      }
    } catch (error) {
      console.error(`[Popup] Failed to update setting ${key}:`, error);
      alert(`Failed to update setting: ${error.message}`);
    }
  }

  /**
   * Reset plugin settings to defaults
   */
  async _resetSettings() {
    if (!this.currentPlugin) return;
    
    const confirmed = confirm(`Reset ${this.currentPlugin.name} settings to defaults?`);
    if (!confirmed) return;
    
    try {
      await this.settings.reset(this.currentPlugin.id);
      
      // Refresh settings view
      this._showSettings(this.currentPlugin.id);
    } catch (error) {
      console.error('[Popup] Failed to reset settings:', error);
      alert(`Failed to reset settings: ${error.message}`);
    }
  }

  /**
   * Export plugin settings
   */
  _exportSettings() {
    if (!this.currentPlugin) return;
    
    const settings = this.settings.getAll(this.currentPlugin.id);
    const json = JSON.stringify(settings, null, 2);
    
    // Create download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentPlugin.id}-settings.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import plugin settings
   */
  _importSettings() {
    if (!this.currentPlugin) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const settings = JSON.parse(text);
        
        // Update settings
        await this.settings.setMany(this.currentPlugin.id, settings);
        
        // Refresh view
        this._showSettings(this.currentPlugin.id);
        
        alert('Settings imported successfully');
      } catch (error) {
        console.error('[Popup] Failed to import settings:', error);
        alert(`Failed to import settings: ${error.message}`);
      }
    });
    
    input.click();
  }

  /**
   * Update footer statistics
   */
  _updateFooter() {
    const total = this.plugins.length;
    const enabled = this.plugins.filter(p => this.settings.isEnabled(p.id)).length;
    
    this.pluginCount.textContent = `${total} plugin${total !== 1 ? 's' : ''} loaded`;
    this.enabledCount.textContent = `${enabled} enabled`;
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupUI();
  });
} else {
  new PopupUI();
}
