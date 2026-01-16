/**
 * Content Script Loader
 * 
 * This script runs FRESH on every page navigation.
 * Content scripts do not persist across navigations - the entire context is recreated.
 * Therefore, we accept re-initialization and make it fast and clean.
 */

const DEBUG = window.location.search.includes('debug=true');

// Set up basic message listener
// Note: This runs fresh on every navigation, no need for guards
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (DEBUG) {
    console.log('[BetterLooksmax] Received message:', message.type, message.action || message.event);
  }
  
  // Handle requests before framework loads
  if (message.type === 'REQUEST' && message.action === 'plugins:getAll') {
    console.log('[BetterLooksmax] Handling plugins:getAll request');
    
    // If framework isn't loaded yet, return empty array
    if (!window.__BetterLooksmaxFramework) {
      console.warn('[BetterLooksmax] Framework not loaded yet, returning empty plugin list');
      sendResponse({
        success: true,
        data: [],
        requestId: message.requestId
      });
      return true;
    }
    
    // Get plugin info from framework
    try {
      const registry = window.__BetterLooksmaxFramework.registry;
      const plugins = registry.getAllPluginInfo();
      console.log('[BetterLooksmax] Returning', plugins.length, 'plugins');
      sendResponse({
        success: true,
        data: plugins,
        requestId: message.requestId
      });
    } catch (error) {
      console.error('[BetterLooksmax] Error getting plugins:', error);
      sendResponse({
        success: false,
        error: error.message,
        requestId: message.requestId
      });
    }
    
    return true; // Keep channel open
  }
  
  // For other messages, framework will handle
  return false;
});

// Load framework
// This runs fresh on every page, which is correct behavior for content scripts
(async function() {
  try {
    if (DEBUG) console.log('[BetterLooksmax] Loading framework...');
    
    // Load security dependencies first
    const dompurifyScript = document.createElement('script');
    dompurifyScript.src = chrome.runtime.getURL('utils/dompurify.min.js');
    
    await new Promise((resolve, reject) => {
      dompurifyScript.onload = resolve;
      dompurifyScript.onerror = reject;
      (document.head || document.documentElement).appendChild(dompurifyScript);
    });
    
    const sanitizerScript = document.createElement('script');
    sanitizerScript.src = chrome.runtime.getURL('utils/sanitizer.js');
    
    await new Promise((resolve, reject) => {
      sanitizerScript.onload = resolve;
      sanitizerScript.onerror = reject;
      (document.head || document.documentElement).appendChild(sanitizerScript);
    });
    
    // Load main framework
    const contentModule = await import(chrome.runtime.getURL('src/content.js'));
    
    // Expose for debugging and message handling
    if (contentModule.default) {
      window.__BetterLooksmaxFramework = contentModule.default;
    }
    
    if (DEBUG) console.log('[BetterLooksmax] Framework loaded');
  } catch (error) {
    console.error('[BetterLooksmax] Failed to load framework:', error);
  }
})();
