/**
 * Plugin Template
 * 
 * This is a complete template showing all available features for plugin development.
 * Copy this template to create your own plugins.
 */

export default {
  // === METADATA === (Required)
  id: 'plugin-template',
  name: 'Plugin Template',
  description: 'A template plugin demonstrating all available features',
  version: '1.0.0',
  author: 'BetterLooksmax Team',
  
  // === DEPENDENCIES === (Optional)
  dependencies: [],              // Other plugin IDs this plugin requires
  optionalDependencies: [],      // Optional plugin IDs
  conflicts: [],                 // Incompatible plugin IDs
  
  // === CATEGORIZATION === (Optional)
  tags: ['template', 'example'],
  category: 'other',
  
  // === SETTINGS SCHEMA === (Optional)
  settings: {
    // Boolean example - renders as toggle switch
    enableFeature: {
      type: 'boolean',
      default: true,
      title: 'Enable Feature',
      description: 'Turn this feature on or off',
      section: 'General'
    },
    
    // String example - renders as text input
    customText: {
      type: 'string',
      default: 'Hello World',
      title: 'Custom Text',
      description: 'Enter custom text',
      placeholder: 'Type something...',
      maxlength: 100,
      section: 'General'
    },
    
    // Number example with slider - renders as range input
    intensity: {
      type: 'number',
      default: 50,
      title: 'Intensity',
      description: 'Adjust the intensity level',
      min: 0,
      max: 100,
      step: 5,
      slider: true,
      section: 'General'
    },
    
    // Enum/Select example - renders as dropdown
    mode: {
      type: 'select',
      default: 'auto',
      title: 'Mode',
      description: 'Select operating mode',
      enum: ['auto', 'manual', 'disabled'],
      section: 'General'
    },
    
    // Color example - renders as color picker
    highlightColor: {
      type: 'color',
      default: '#4CAF50',
      title: 'Highlight Color',
      description: 'Choose highlight color',
      section: 'Appearance'
    },
    
    // Advanced boolean with conditional visibility
    debugMode: {
      type: 'boolean',
      default: false,
      title: 'Debug Mode',
      description: 'Enable debug logging',
      section: 'Advanced'
    },
    
    // Custom validation example
    maxItems: {
      type: 'number',
      default: 10,
      title: 'Max Items',
      description: 'Maximum number of items (5-50)',
      min: 5,
      max: 50,
      validator: (value) => value >= 5 && value <= 50,
      section: 'Advanced'
    }
  },
  
  // === LIFECYCLE METHODS ===
  
  /**
   * Initialize plugin (one-time setup)
   * Called once when plugin is first loaded
   * 
   * @param {object} api - Plugin API object
   */
  async init(api) {
    api.utils.logger.info('Plugin template initializing...');
    
    // Perform one-time setup here
    // Example: Create persistent data structures
    // Example: Register global event listeners
    
    api.utils.logger.info('Plugin template initialized');
  },
  
  /**
   * Start plugin (enable it)
   * Called when plugin is enabled
   * 
   * @param {object} api - Plugin API object
   */
  async start(api) {
    api.utils.logger.info('Plugin template starting...');
    
    // Get current settings
    const enableFeature = api.settings.get('enableFeature');
    const customText = api.settings.get('customText');
    const mode = api.settings.get('mode');
    
    api.utils.logger.info('Settings:', { enableFeature, customText, mode });
    
    // Example: Inject styles
    if (enableFeature) {
      api.dom.style(`
        .template-highlight {
          background-color: ${api.settings.get('highlightColor')};
          padding: 2px 4px;
          border-radius: 3px;
        }
      `, 'plugin-template-styles');
    }
    
    // Example: Wait for specific element
    try {
      const element = await api.dom.waitFor('body', 2000);
      api.utils.logger.info('Found body element:', element);
    } catch (error) {
      api.utils.logger.warn('Body element not found:', error);
    }
    
    // Example: Sanitize user content (SECURITY)
    if (api.sanitizer) {
      // Sanitize HTML content
      const unsafeHTML = '<script>alert("XSS")</script><b>Safe text</b>';
      const safeHTML = api.sanitizer.sanitizeHTML(unsafeHTML);
      api.utils.logger.info('Sanitized HTML:', safeHTML);
      
      // Sanitize CSS
      const unsafeCSS = 'color: red; behavior: url(evil.htc);';
      const safeCSS = api.sanitizer.sanitizeCSS(unsafeCSS);
      api.utils.logger.info('Sanitized CSS:', safeCSS);
    }
    
    // Example: Create UI button
    const button = api.ui.createButton({
      text: 'Template Button',
      className: 'template-btn',
      title: 'Click to test',
      onClick: () => {
        // Safely escape customText before displaying
        const safeText = api.sanitizer 
          ? api.sanitizer.sanitizeText(customText)
          : customText;
        
        api.ui.createNotification({
          message: `Plugin Template: ${safeText}`,
          type: 'info',
          duration: 3000
        });
      }
    });
    
    // Example: Inject button into page (if target exists)
    const targetExists = document.querySelector('.target-container');
    if (targetExists) {
      api.dom.inject(button, 'append', targetExists);
    }
    
    // Example: Watch setting changes
    api.settings.watch('customText', (newValue, oldValue) => {
      api.utils.logger.info(`Custom text changed from "${oldValue}" to "${newValue}"`);
    });
    
    api.utils.logger.info('Plugin template started successfully');
  },
  
  /**
   * Stop plugin (disable it)
   * Called when plugin is disabled
   * 
   * @param {object} api - Plugin API object
   */
  async stop(api) {
    api.utils.logger.info('Plugin template stopping...');
    
    // Clean up injected styles
    api.dom.removeStyle('plugin-template-styles');
    
    // Remove injected elements
    const button = document.querySelector('.template-btn');
    if (button) {
      api.dom.remove(button);
    }
    
    // Clean up is automatic for:
    // - Registered hooks (unregistered automatically)
    // - Setting watchers (need to store unwatch function to manually clean)
    
    api.utils.logger.info('Plugin template stopped');
  },
  
  /**
   * Destroy plugin (final cleanup)
   * Called when plugin is being unloaded completely
   * 
   * @param {object} api - Plugin API object
   */
  async destroy(api) {
    api.utils.logger.info('Plugin template destroying...');
    
    // Perform final cleanup
    // Example: Clear any stored data
    await api.storage.remove('cachedData');
    
    api.utils.logger.info('Plugin template destroyed');
  },
  
  // === HOOKS === (Optional)
  // Hooks are automatically registered when plugin starts
  // and unregistered when plugin stops
  
  hooks: {
    /**
     * DOM ready hook
     * Called when DOM is ready
     */
    'dom:ready': async (context) => {
      console.log('[Plugin Template] DOM is ready');
    },
    
    /**
     * DOM mutated hook
     * Called when DOM changes (throttled)
     */
    'dom:mutated': async (context) => {
      // Handle DOM mutations
      // const { mutations } = context.data;
    },
    
    /**
     * Settings changed hook
     * Called when any setting changes
     */
    'settings:changed': async (context) => {
      const { pluginId, key, value } = context.data;
      console.log(`[Plugin Template] Setting changed: ${pluginId}.${key} = ${value}`);
    }
  }
};
