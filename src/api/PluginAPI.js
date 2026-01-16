/**
 * PluginAPI - Unified API surface for plugins
 * 
 * Creates the API object that plugins receive in their lifecycle methods.
 * Provides access to settings, hooks, DOM utilities, storage, UI components, etc.
 */

import SettingsStore from '../core/SettingsStore.js';
import HookSystem from '../core/HookSystem.js';
import StorageAdapter from '../core/StorageAdapter.js';
import PluginRegistry from '../core/PluginRegistry.js';
import DOMUtils from '../../utils/dom.js';
import Logger from '../../utils/logger.js';
import Validators from '../../utils/validators.js';

class PluginAPI {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.logger = Logger.child(pluginId);
    
    // Bind methods to preserve context
    this._bindMethods();
  }

  /**
   * Bind all methods to preserve context
   */
  _bindMethods() {
    // Settings API
    this.settings = {
      get: this._settingsGet.bind(this),
      set: this._settingsSet.bind(this),
      watch: this._settingsWatch.bind(this),
      getAll: this._settingsGetAll.bind(this)
    };

    // Hooks API
    this.hooks = {
      register: this._hooksRegister.bind(this),
      unregister: this._hooksUnregister.bind(this),
      emit: this._hooksEmit.bind(this)
    };

    // DOM API
    this.dom = {
      waitFor: DOMUtils.waitFor.bind(DOMUtils),
      waitForAll: DOMUtils.waitForAll.bind(DOMUtils),
      observe: DOMUtils.observe.bind(DOMUtils),
      inject: DOMUtils.inject.bind(DOMUtils),
      remove: DOMUtils.remove.bind(DOMUtils),
      style: DOMUtils.style.bind(DOMUtils),
      removeStyle: DOMUtils.removeStyle.bind(DOMUtils),
      createElement: DOMUtils.createElement.bind(DOMUtils),
      isVisible: DOMUtils.isVisible.bind(DOMUtils),
      getPosition: DOMUtils.getPosition.bind(DOMUtils),
      scrollIntoView: DOMUtils.scrollIntoView.bind(DOMUtils),
      addClass: DOMUtils.addClass.bind(DOMUtils),
      removeClass: DOMUtils.removeClass.bind(DOMUtils),
      toggleClass: DOMUtils.toggleClass.bind(DOMUtils),
      getTextNodes: DOMUtils.getTextNodes.bind(DOMUtils),
      replaceText: DOMUtils.replaceText.bind(DOMUtils)
    };

    // Storage API (namespaced to plugin)
    this.storage = StorageAdapter.namespace(this.pluginId);

    // UI API
    this.ui = {
      createButton: this._uiCreateButton.bind(this),
      createModal: this._uiCreateModal.bind(this),
      createNotification: this._uiCreateNotification.bind(this),
      createPanel: this._uiCreatePanel.bind(this)
    };

    // Plugins API
    this.plugins = {
      get: this._pluginsGet.bind(this),
      call: this._pluginsCall.bind(this),
      isEnabled: this._pluginsIsEnabled.bind(this)
    };

    // Utils API
    this.utils = {
      throttle: DOMUtils.throttle.bind(DOMUtils),
      debounce: DOMUtils.debounce.bind(DOMUtils),
      sanitize: Validators.sanitizeHTML.bind(Validators),
      escapeHTML: Validators.escapeHTML.bind(Validators),
      validateSchema: Validators.validateSchema.bind(Validators),
      deepClone: Validators.deepClone.bind(Validators),
      deepEqual: Validators.deepEqual.bind(Validators),
      logger: this.logger
    };
    
    // Security/Sanitizer API (if available)
    if (typeof window.BetterLooksmaxSanitizer !== 'undefined') {
      this.sanitizer = {
        sanitizeCSS: window.BetterLooksmaxSanitizer.sanitizeCSS.bind(window.BetterLooksmaxSanitizer),
        sanitizeHTML: window.BetterLooksmaxSanitizer.sanitizeHTML.bind(window.BetterLooksmaxSanitizer),
        sanitizeText: window.BetterLooksmaxSanitizer.sanitizeText.bind(window.BetterLooksmaxSanitizer),
        escapeText: window.BetterLooksmaxSanitizer.escapeText.bind(window.BetterLooksmaxSanitizer),
        safeInsertText: window.BetterLooksmaxSanitizer.safeInsertText.bind(window.BetterLooksmaxSanitizer),
        safeInsertFormattedText: window.BetterLooksmaxSanitizer.safeInsertFormattedText.bind(window.BetterLooksmaxSanitizer),
        isSafeCSSproperty: window.BetterLooksmaxSanitizer.isSafeCSSproperty.bind(window.BetterLooksmaxSanitizer),
        isSafeCSSValue: window.BetterLooksmaxSanitizer.isSafeCSSValue.bind(window.BetterLooksmaxSanitizer)
      };
    }
  }

  // === SETTINGS API ===

  _settingsGet(key) {
    return SettingsStore.get(this.pluginId, key);
  }

  async _settingsSet(key, value) {
    return await SettingsStore.set(this.pluginId, key, value);
  }

  _settingsWatch(key, callback) {
    return SettingsStore.watch(this.pluginId, key, callback);
  }

  _settingsGetAll() {
    return SettingsStore.getAll(this.pluginId);
  }

  // === HOOKS API ===

  _hooksRegister(hookName, handler, options = {}) {
    return HookSystem.register(hookName, handler, {
      ...options,
      plugin: this.pluginId
    });
  }

  _hooksUnregister(hookName, handler) {
    return HookSystem.unregister(hookName, handler);
  }

  async _hooksEmit(hookName, data, options) {
    return await HookSystem.emit(hookName, data, options);
  }

  // === UI API ===

  _uiCreateButton(options) {
    const {
      text = 'Button',
      icon = null,
      className = '',
      onClick = null,
      title = ''
    } = options;

    const button = document.createElement('button');
    button.className = `plugin-button ${className}`;
    if (title) button.title = title;

    if (icon) {
      const iconEl = document.createElement('i');
      iconEl.className = icon;
      button.appendChild(iconEl);
      button.appendChild(document.createTextNode(' '));
    }

    button.appendChild(document.createTextNode(text));

    if (onClick) {
      button.addEventListener('click', onClick);
    }

    return button;
  }

  _uiCreateModal(options) {
    const {
      title = 'Modal',
      content = '',
      buttons = [],
      onClose = null,
      className = ''
    } = options;

    const overlay = document.createElement('div');
    overlay.className = 'plugin-modal-overlay';

    const modal = document.createElement('div');
    modal.className = `plugin-modal ${className}`;

    const header = document.createElement('div');
    header.className = 'plugin-modal-header';
    header.innerHTML = `
      <h3>${Validators.escapeHTML(title)}</h3>
      <button class="plugin-modal-close">&times;</button>
    `;

    const body = document.createElement('div');
    body.className = 'plugin-modal-body';
    
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }

    const footer = document.createElement('div');
    footer.className = 'plugin-modal-footer';
    
    buttons.forEach(btn => {
      const button = this._uiCreateButton(btn);
      footer.appendChild(button);
    });

    modal.appendChild(header);
    modal.appendChild(body);
    if (buttons.length > 0) {
      modal.appendChild(footer);
    }

    overlay.appendChild(modal);

    const close = () => {
      overlay.remove();
      if (onClose) onClose();
    };

    header.querySelector('.plugin-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    return {
      element: overlay,
      show: () => document.body.appendChild(overlay),
      close
    };
  }

  _uiCreateNotification(options) {
    const {
      message = '',
      type = 'info',
      duration = 3000,
      position = 'top-right'
    } = options;

    const notification = document.createElement('div');
    notification.className = `plugin-notification plugin-notification-${type} plugin-notification-${position}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    if (duration > 0) {
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, duration);
    }

    return {
      element: notification,
      close: () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }
    };
  }

  _uiCreatePanel(options) {
    const {
      title = 'Panel',
      content = '',
      collapsible = true,
      collapsed = false,
      className = ''
    } = options;

    const panel = document.createElement('div');
    panel.className = `plugin-panel ${className}`;
    if (collapsed) panel.classList.add('collapsed');

    const header = document.createElement('div');
    header.className = 'plugin-panel-header';
    
    if (collapsible) {
      const toggle = document.createElement('button');
      toggle.className = 'plugin-panel-toggle';
      toggle.textContent = collapsed ? '▶' : '▼';
      header.appendChild(toggle);

      toggle.addEventListener('click', () => {
        const isCollapsed = panel.classList.toggle('collapsed');
        toggle.textContent = isCollapsed ? '▶' : '▼';
      });
    }

    const titleEl = document.createElement('h4');
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'plugin-panel-body';
    
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }

    panel.appendChild(header);
    panel.appendChild(body);

    return panel;
  }

  // === PLUGINS API ===

  _pluginsGet(pluginId) {
    return PluginRegistry.getInstance(pluginId);
  }

  async _pluginsCall(pluginId, method, ...args) {
    const instance = PluginRegistry.getInstance(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (typeof instance[method] !== 'function') {
      throw new Error(`Method ${method} not found on plugin ${pluginId}`);
    }

    return await instance[method](...args);
  }

  _pluginsIsEnabled(pluginId) {
    return PluginRegistry.getState(pluginId) === PluginRegistry.STATES.ACTIVE;
  }
}

/**
 * Create a PluginAPI instance for a specific plugin
 * @param {string} pluginId - Plugin ID
 * @returns {PluginAPI} API instance
 */
export function createPluginAPI(pluginId) {
  return new PluginAPI(pluginId);
}

export default PluginAPI;
