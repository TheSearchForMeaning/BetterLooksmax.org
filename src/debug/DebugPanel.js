/**
 * Debug Panel - Developer debugging tools
 * 
 * Provides debug panel with plugin inspector, hook tracer, and logs.
 * Only active when debug mode is enabled.
 */

import PluginRegistry from '../core/PluginRegistry.js';
import HookSystem from '../core/HookSystem.js';
import SettingsStore from '../core/SettingsStore.js';

class DebugPanel {
  constructor() {
    this.registry = PluginRegistry;
    this.hooks = HookSystem;
    this.settings = SettingsStore;
    
    this.panel = null;
    this.visible = false;
    this.logs = [];
    this.maxLogs = 100;
  }

  /**
   * Initialize debug panel
   */
  init() {
    if (this.panel) return;

    this._createPanel();
    this._setupHooks();
    this._injectStyles();
    
    // Add keyboard shortcut (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Create debug panel element
   */
  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'debug-panel';
    this.panel.innerHTML = `
      <div class="debug-panel-header">
        <h3>🐛 Debug Panel</h3>
        <button class="debug-close-btn">×</button>
      </div>
      
      <div class="debug-panel-tabs">
        <button class="debug-tab active" data-tab="plugins">Plugins</button>
        <button class="debug-tab" data-tab="hooks">Hooks</button>
        <button class="debug-tab" data-tab="logs">Logs</button>
        <button class="debug-tab" data-tab="stats">Stats</button>
      </div>
      
      <div class="debug-panel-content">
        <div class="debug-tab-content active" data-content="plugins">
          <div id="debugPluginsList"></div>
        </div>
        
        <div class="debug-tab-content" data-content="hooks">
          <div id="debugHooksList"></div>
        </div>
        
        <div class="debug-tab-content" data-content="logs">
          <div class="debug-logs-controls">
            <button id="debugClearLogs">Clear</button>
          </div>
          <div id="debugLogsList"></div>
        </div>
        
        <div class="debug-tab-content" data-content="stats">
          <div id="debugStats"></div>
        </div>
      </div>
    `;

    // Setup event listeners
    this.panel.querySelector('.debug-close-btn').addEventListener('click', () => {
      this.hide();
    });

    this.panel.querySelectorAll('.debug-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._switchTab(tab.dataset.tab);
      });
    });

    this.panel.querySelector('#debugClearLogs').addEventListener('click', () => {
      this.clearLogs();
    });

    document.body.appendChild(this.panel);
  }

  /**
   * Inject debug panel styles
   */
  _injectStyles() {
    const style = document.createElement('style');
    style.id = 'debug-panel-styles';
    style.textContent = `
      .debug-panel {
        position: fixed;
        top: 50px;
        right: 20px;
        width: 400px;
        max-height: 600px;
        background: #1a1a1a;
        border: 1px solid #404040;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        z-index: 999999;
        display: none;
        flex-direction: column;
        font-family: monospace;
        font-size: 12px;
      }
      
      .debug-panel.visible {
        display: flex;
      }
      
      .debug-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: #2a2a2a;
        border-bottom: 1px solid #404040;
        border-radius: 8px 8px 0 0;
      }
      
      .debug-panel-header h3 {
        margin: 0;
        font-size: 14px;
        color: #fff;
      }
      
      .debug-close-btn {
        background: transparent;
        border: none;
        color: #fff;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      
      .debug-panel-tabs {
        display: flex;
        gap: 4px;
        padding: 8px;
        background: #2a2a2a;
        border-bottom: 1px solid #404040;
      }
      
      .debug-tab {
        flex: 1;
        padding: 6px 12px;
        background: #1a1a1a;
        border: 1px solid #404040;
        border-radius: 4px;
        color: #b0b0b0;
        cursor: pointer;
        font-size: 11px;
      }
      
      .debug-tab.active {
        background: #4CAF50;
        color: white;
        border-color: #4CAF50;
      }
      
      .debug-panel-content {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
      }
      
      .debug-tab-content {
        display: none;
      }
      
      .debug-tab-content.active {
        display: block;
      }
      
      .debug-plugin-item,
      .debug-hook-item,
      .debug-log-item {
        padding: 8px;
        margin-bottom: 8px;
        background: #2a2a2a;
        border: 1px solid #404040;
        border-radius: 4px;
        color: #fff;
      }
      
      .debug-plugin-item.active {
        border-color: #4CAF50;
      }
      
      .debug-plugin-item.error {
        border-color: #f44336;
      }
      
      .debug-logs-controls {
        margin-bottom: 8px;
      }
      
      .debug-log-item {
        font-size: 11px;
      }
      
      .debug-log-item .timestamp {
        color: #b0b0b0;
        margin-right: 8px;
      }
      
      .debug-log-item.error {
        border-left: 3px solid #f44336;
      }
      
      .debug-log-item.warn {
        border-left: 3px solid #FFA500;
      }
      
      .debug-log-item.info {
        border-left: 3px solid #4CAF50;
      }
      
      .debug-stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      
      .debug-stat-card {
        padding: 12px;
        background: #2a2a2a;
        border: 1px solid #404040;
        border-radius: 4px;
      }
      
      .debug-stat-value {
        font-size: 24px;
        font-weight: bold;
        color: #4CAF50;
      }
      
      .debug-stat-label {
        font-size: 10px;
        color: #b0b0b0;
        margin-top: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup hooks for debugging
   */
  _setupHooks() {
    // Log all hook emissions
    const originalEmit = this.hooks.emit.bind(this.hooks);
    this.hooks.emit = async (hookName, data, options) => {
      this.log('info', `Hook emitted: ${hookName}`, data);
      return await originalEmit(hookName, data, options);
    };

    // Intercept console methods
    ['log', 'info', 'warn', 'error'].forEach(method => {
      const original = console[method];
      console[method] = (...args) => {
        this.log(method === 'log' ? 'info' : method, ...args);
        original.apply(console, args);
      };
    });
  }

  /**
   * Switch tab
   */
  _switchTab(tabName) {
    // Update tab buttons
    this.panel.querySelectorAll('.debug-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update content
    this.panel.querySelectorAll('.debug-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.content === tabName);
    });

    // Refresh content
    this._refreshContent(tabName);
  }

  /**
   * Refresh content for current tab
   */
  _refreshContent(tabName) {
    switch (tabName) {
      case 'plugins':
        this._refreshPlugins();
        break;
      case 'hooks':
        this._refreshHooks();
        break;
      case 'logs':
        this._refreshLogs();
        break;
      case 'stats':
        this._refreshStats();
        break;
    }
  }

  /**
   * Refresh plugins list
   */
  _refreshPlugins() {
    const container = this.panel.querySelector('#debugPluginsList');
    const plugins = this.registry.getAllPluginInfo();

    container.innerHTML = plugins.map(p => `
      <div class="debug-plugin-item ${p.state.toLowerCase()}">
        <strong>${p.name}</strong> (${p.id})<br>
        <small>State: ${p.state} | Version: ${p.version}</small>
      </div>
    `).join('');
  }

  /**
   * Refresh hooks list
   */
  _refreshHooks() {
    const container = this.panel.querySelector('#debugHooksList');
    const hooks = this.hooks.getRegisteredHooks();

    container.innerHTML = hooks.map(hookName => `
      <div class="debug-hook-item">
        <strong>${hookName}</strong><br>
        <small>Handlers: ${this.hooks.getHandlerCount(hookName)}</small>
      </div>
    `).join('');
  }

  /**
   * Refresh logs list
   */
  _refreshLogs() {
    const container = this.panel.querySelector('#debugLogsList');

    container.innerHTML = this.logs.slice().reverse().map(log => `
      <div class="debug-log-item ${log.level}">
        <span class="timestamp">${log.timestamp}</span>
        ${log.message}
      </div>
    `).join('');
  }

  /**
   * Refresh stats
   */
  _refreshStats() {
    const container = this.panel.querySelector('#debugStats');
    const stats = this.registry.getStats();

    container.innerHTML = `
      <div class="debug-stats-grid">
        <div class="debug-stat-card">
          <div class="debug-stat-value">${stats.total}</div>
          <div class="debug-stat-label">Total Plugins</div>
        </div>
        <div class="debug-stat-card">
          <div class="debug-stat-value">${stats.byState.ACTIVE || 0}</div>
          <div class="debug-stat-label">Active Plugins</div>
        </div>
        <div class="debug-stat-card">
          <div class="debug-stat-value">${this.hooks.getRegisteredHooks().length}</div>
          <div class="debug-stat-label">Registered Hooks</div>
        </div>
        <div class="debug-stat-card">
          <div class="debug-stat-value">${this.logs.length}</div>
          <div class="debug-stat-label">Log Entries</div>
        </div>
      </div>
      
      <h4 style="margin-top: 16px; color: #4CAF50;">States</h4>
      ${Object.entries(stats.byState).map(([state, count]) => `
        <div style="margin: 4px 0;">${state}: ${count}</div>
      `).join('')}
    `;
  }

  /**
   * Log a message
   */
  log(level, ...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    this.logs.push({
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    });

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Refresh logs if visible
    if (this.visible) {
      this._refreshLogs();
    }
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
    this._refreshLogs();
  }

  /**
   * Show debug panel
   */
  show() {
    this.visible = true;
    this.panel.classList.add('visible');
    this._refreshContent('plugins');
  }

  /**
   * Hide debug panel
   */
  hide() {
    this.visible = false;
    this.panel.classList.remove('visible');
  }

  /**
   * Toggle debug panel
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
}

export default new DebugPanel();
