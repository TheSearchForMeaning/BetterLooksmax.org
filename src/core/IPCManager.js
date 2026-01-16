/**
 * IPCManager - Inter-Process Communication
 * 
 * Routes messages between content script, background worker, and popup
 * with request/response pattern and timeout management.
 */

class IPCManager {
  constructor() {
    // Message types
    this.MESSAGE_TYPES = {
      REQUEST: 'REQUEST',
      RESPONSE: 'RESPONSE',
      EVENT: 'EVENT',
      BROADCAST: 'BROADCAST'
    };

    // Pending requests waiting for responses
    this.pendingRequests = new Map();
    
    // Request ID counter
    this.requestId = 0;
    
    // Default timeout
    this.defaultTimeout = 5000;
    
    // Message handlers
    this.handlers = new Map();
    
    // Lifecycle state
    this.destroyed = false;
    
    // Browser API
    this.runtime = this._getBrowserAPI();
    
    // Message listener reference for cleanup
    this.messageListener = null;
    
    // Setup message listener
    this._setupListener();
  }

  /**
   * Get the appropriate browser runtime API
   */
  _getBrowserAPI() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime;
    } else if (typeof browser !== 'undefined' && browser.runtime) {
      return browser.runtime;
    }
    return null;
  }

  /**
   * Setup message listener
   */
  _setupListener() {
    if (!this.runtime) return;

    // Store listener reference for cleanup
    this.messageListener = (message, sender, sendResponse) => {
      // Don't process messages if destroyed
      if (this.destroyed) {
        return false; // Don't keep channel open
      }
      
      // Handle message async
      this._handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    };
    
    this.runtime.onMessage.addListener(this.messageListener);
  }

  /**
   * Handle incoming message
   */
  async _handleMessage(message, sender, sendResponse) {
    if (!message || !message.type) return;
    
    // Check if we're still alive before processing
    if (this.destroyed) {
      return;
    }

    // Wrap sendResponse to check context validity
    const safeSendResponse = (response) => {
      if (this.destroyed) {
        // Context destroyed, don't try to respond
        return;
      }
      
      try {
        sendResponse(response);
      } catch (error) {
        // Context invalidated - expected, don't log spam
        if (!error.message?.includes('Extension context invalidated')) {
          console.warn('[IPCManager] Failed to send response:', error.message);
        }
      }
    };

    try {
      switch (message.type) {
        case this.MESSAGE_TYPES.REQUEST:
          await this._handleRequest(message, sender, safeSendResponse);
          break;
          
        case this.MESSAGE_TYPES.RESPONSE:
          this._handleResponse(message);
          break;
          
        case this.MESSAGE_TYPES.EVENT:
          await this._handleEvent(message, sender);
          break;
          
        case this.MESSAGE_TYPES.BROADCAST:
          await this._handleBroadcast(message, sender);
          break;
      }
    } catch (error) {
      // Don't log context invalidation errors
      if (!error.message?.includes('Extension context invalidated')) {
        console.error('[IPCManager] Error handling message:', error);
      }
      
      if (message.type === this.MESSAGE_TYPES.REQUEST) {
        safeSendResponse({
          success: false,
          error: error.message
        });
      }
    }
  }

  /**
   * Handle REQUEST message
   */
  async _handleRequest(message, sender, sendResponse) {
    const { action, data, requestId } = message;
    
    const handler = this.handlers.get(action);
    if (!handler) {
      sendResponse({
        success: false,
        error: `No handler for action: ${action}`
      });
      return;
    }

    try {
      const result = await handler(data, sender);
      sendResponse({
        success: true,
        data: result,
        requestId
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message,
        requestId
      });
    }
  }

  /**
   * Handle RESPONSE message
   */
  _handleResponse(message) {
    const { requestId, success, data, error } = message;
    
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    if (success) {
      pending.resolve(data);
    } else {
      pending.reject(new Error(error || 'Request failed'));
    }
  }

  /**
   * Handle EVENT message
   */
  async _handleEvent(message, sender) {
    const { event, data } = message;
    
    const handler = this.handlers.get(event);
    if (handler) {
      try {
        await handler(data, sender);
      } catch (error) {
        console.error(`[IPCManager] Error in event handler for ${event}:`, error);
      }
    }
  }

  /**
   * Handle BROADCAST message
   */
  async _handleBroadcast(message, sender) {
    // Same as event but indicates it was sent to all contexts
    await this._handleEvent(message, sender);
  }

  /**
   * Send a request and wait for response
   * @param {string} action - Action to perform
   * @param {*} data - Data to send
   * @param {object} options - Request options
   * @returns {Promise<*>} Response data
   */
  async request(action, data = null, options = {}) {
    // Don't send if destroyed
    if (this.destroyed) {
      throw new Error('IPC destroyed - cannot send request');
    }
    
    const {
      timeout = this.defaultTimeout,
      target = null
    } = options;

    const requestId = ++this.requestId;
    
    const message = {
      type: this.MESSAGE_TYPES.REQUEST,
      action,
      data,
      requestId,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      // Check again before setting up
      if (this.destroyed) {
        reject(new Error('IPC destroyed during request setup'));
        return;
      }
      
      // Setup timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${action}`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutId,
        action,
        timestamp: Date.now()
      });

      // Send message
      try {
        if (target) {
          // Send to specific tab/context
          this.runtime.sendMessage(target, message).catch(error => {
            // Handle send failures
            clearTimeout(timeoutId);
            this.pendingRequests.delete(requestId);
            
            // Don't spam logs for context invalidation
            if (!error.message?.includes('Extension context invalidated') &&
                !error.message?.includes('Receiving end does not exist')) {
              reject(error);
            } else {
              reject(new Error('Context no longer available'));
            }
          });
        } else {
          // Send to background/extension
          this.runtime.sendMessage(message).catch(error => {
            clearTimeout(timeoutId);
            this.pendingRequests.delete(requestId);
            
            if (!error.message?.includes('Extension context invalidated') &&
                !error.message?.includes('Receiving end does not exist')) {
              reject(error);
            } else {
              reject(new Error('Context no longer available'));
            }
          });
        }
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Send an event (fire-and-forget)
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @param {object} options - Event options
   */
  async sendEvent(event, data = null, options = {}) {
    // Don't send if destroyed
    if (this.destroyed) {
      return;
    }
    
    const { target = null } = options;

    const message = {
      type: this.MESSAGE_TYPES.EVENT,
      event,
      data,
      timestamp: Date.now()
    };

    try {
      if (target) {
        await this.runtime.sendMessage(target, message);
      } else {
        await this.runtime.sendMessage(message);
      }
    } catch (error) {
      // Silently ignore context invalidation errors
      if (!error.message?.includes('Extension context invalidated') &&
          !error.message?.includes('Receiving end does not exist')) {
        console.error(`[IPCManager] Error sending event ${event}:`, error);
      }
    }
  }

  /**
   * Broadcast a message to all contexts
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  async broadcast(event, data = null) {
    // Don't send if destroyed
    if (this.destroyed) {
      return;
    }
    
    const message = {
      type: this.MESSAGE_TYPES.BROADCAST,
      event,
      data,
      timestamp: Date.now()
    };

    try {
      // Send to all tabs
      if (chrome?.tabs) {
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {
              // Silently ignore - tabs may not have listeners
            });
          }
        });
      }
      
      // Also send to runtime (background/popup)
      await this.runtime.sendMessage(message);
    } catch (error) {
      // Silently ignore context invalidation
      if (!error.message?.includes('Extension context invalidated') &&
          !error.message?.includes('Receiving end does not exist')) {
        console.error(`[IPCManager] Error broadcasting ${event}:`, error);
      }
    }
  }

  /**
   * Register a message handler
   * @param {string} actionOrEvent - Action/event name
   * @param {Function} handler - Handler function
   * @returns {Function} Unregister function
   */
  on(actionOrEvent, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    this.handlers.set(actionOrEvent, handler);

    // Return unregister function
    return () => {
      this.handlers.delete(actionOrEvent);
    };
  }

  /**
   * Unregister a message handler
   * @param {string} actionOrEvent - Action/event name
   */
  off(actionOrEvent) {
    this.handlers.delete(actionOrEvent);
  }

  /**
   * Send message to specific tab
   * @param {number} tabId - Tab ID
   * @param {string} action - Action name
   * @param {*} data - Data to send
   */
  async sendToTab(tabId, action, data = null) {
    if (!chrome?.tabs) {
      throw new Error('Tabs API not available');
    }

    const message = {
      type: this.MESSAGE_TYPES.EVENT,
      event: action,
      data,
      timestamp: Date.now()
    };

    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error(`[IPCManager] Error sending to tab ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active tabs
   * @returns {Promise<object[]>} Array of tabs
   */
  async getAllTabs() {
    if (!chrome?.tabs) {
      return [];
    }

    try {
      return await chrome.tabs.query({});
    } catch (error) {
      console.error('[IPCManager] Error getting tabs:', error);
      return [];
    }
  }

  /**
   * Get current tab
   * @returns {Promise<object>} Current tab
   */
  async getCurrentTab() {
    if (!chrome?.tabs) {
      return null;
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0] || null;
    } catch (error) {
      console.error('[IPCManager] Error getting current tab:', error);
      return null;
    }
  }

  /**
   * Check if message passing is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.runtime !== null;
  }

  /**
   * Get IPC statistics
   * @returns {object} IPC stats
   */
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      handlers: this.handlers.size,
      nextRequestId: this.requestId + 1
    };
  }

  /**
   * Destroy IPC manager - reject pending requests and remove listeners
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Reject all pending requests with clear error
    this.pendingRequests.forEach(pending => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('IPC destroyed - context ending'));
    });
    
    this.pendingRequests.clear();
    this.handlers.clear();
    
    // Remove message listener
    if (this.messageListener && this.runtime) {
      try {
        this.runtime.onMessage.removeListener(this.messageListener);
      } catch (error) {
        // Context may already be invalid
      }
      this.messageListener = null;
    }
  }
  
  /**
   * Legacy clear method - calls destroy
   */
  clear() {
    this.destroy();
  }

  /**
   * Create a typed channel for specific message types
   * @param {string} namespace - Channel namespace
   * @returns {object} Channel interface
   */
  createChannel(namespace) {
    return {
      request: (action, data, options) => 
        this.request(`${namespace}:${action}`, data, options),
      
      sendEvent: (event, data, options) => 
        this.sendEvent(`${namespace}:${event}`, data, options),
      
      on: (actionOrEvent, handler) => 
        this.on(`${namespace}:${actionOrEvent}`, handler),
      
      off: (actionOrEvent) => 
        this.off(`${namespace}:${actionOrEvent}`)
    };
  }
}

// Export singleton instance
export default new IPCManager();
