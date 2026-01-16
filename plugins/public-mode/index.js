/**
 * Public Mode Plugin for BetterLooksmax
 * Hides identifying content and replaces sensitive text for privacy
 */

export default {
    id: 'public-mode',
    name: 'Public Mode',
    description: 'Hide identifying content, blur media, and replace sensitive text for privacy when viewing in public',
    version: '1.0.0',
    author: 'BetterLooksmax',
    category: 'privacy',
    tags: ['privacy', 'security', 'blur'],
    
    settings: {
      enabled: {
        type: 'boolean',
        default: false,
        title: 'Enable Public Mode',
        description: 'Toggle public mode on/off',
        section: 'General'
      },
      blurIntensity: {
        type: 'number',
        default: 12,
        min: 4,
        max: 20,
        step: 2,
        slider: true,
        title: 'Blur Intensity',
        description: 'How much to blur media content (px)',
        section: 'Appearance'
      },
      keyboardShortcut: {
        type: 'boolean',
        default: true,
        title: 'Keyboard Shortcut (Ctrl+Shift+P)',
        description: 'Enable keyboard shortcut to toggle public mode',
        section: 'General'
      },
      showNotifications: {
        type: 'boolean',
        default: false,
        title: 'Show Notifications',
        description: 'Show notification when toggling public mode',
        section: 'General'
      },
      replaceText: {
        type: 'boolean',
        default: true,
        title: 'Replace Sensitive Text',
        description: 'Replace sensitive words with neutral alternatives',
        section: 'Text Replacement'
      },
      hideAvatars: {
        type: 'boolean',
        default: true,
        title: 'Hide User Avatars',
        description: 'Replace avatars with default icon',
        section: 'Appearance'
      },
      hideLogos: {
        type: 'boolean',
        default: true,
        title: 'Hide Site Logos',
        description: 'Hide site logos and branding',
        section: 'Appearance'
      },
      blurSignatures: {
        type: 'boolean',
        default: true,
        title: 'Blur Signatures',
        description: 'Blur user signatures',
        section: 'Appearance'
      }
    },
  
    // Store plugin state
    state: {
      isActive: false,
      originalTextContent: new Map(),
      processedNodes: new WeakSet(),
      button: null,
      keyboardHandler: null
    },
  
    async init(api) {
      api.utils.logger.info('Public Mode plugin initializing...');
    },
  
    async start(api) {
      const enabled = api.settings.get('enabled');
      
      // Create and inject the public mode button
      this.createButton(api);
      
      // Setup keyboard shortcut if enabled
      if (api.settings.get('keyboardShortcut')) {
        this.setupKeyboardShortcut(api);
      }
      
      // Apply public mode if it was previously enabled
      if (enabled) {
        this.state.isActive = true;
        this.applyPublicMode(api);
        this.updateButtonState(api, true);
      }
      
      // Watch for setting changes
      api.settings.watch('enabled', (newVal) => {
        this.state.isActive = newVal;
        if (newVal) {
          this.applyPublicMode(api);
        } else {
          this.removePublicMode(api);
        }
        this.updateButtonState(api, newVal);
      });
      
      api.settings.watch('blurIntensity', () => {
        if (this.state.isActive) {
          this.updateStyles(api);
        }
      });
      
      api.settings.watch('keyboardShortcut', (newVal) => {
        if (newVal) {
          this.setupKeyboardShortcut(api);
        } else {
          this.removeKeyboardShortcut();
        }
      });
      
      api.utils.logger.info('Public Mode plugin started');
    },
  
    async stop(api) {
      // Remove public mode if active
      if (this.state.isActive) {
        this.removePublicMode(api);
      }
      
      // Remove button
      if (this.state.button) {
        api.dom.remove(this.state.button);
        this.state.button = null;
      }
      
      // Remove keyboard shortcut
      this.removeKeyboardShortcut();
      
      // Clear state
      this.state.originalTextContent.clear();
      this.state.processedNodes = new WeakSet();
      
      api.utils.logger.info('Public Mode plugin stopped');
    },
  
    async destroy(api) {
      await api.storage.remove('publicModeState');
      api.utils.logger.info('Public Mode plugin destroyed');
    },
  
    // Create the public mode toggle button
    createButton(api) {
      const button = document.createElement('a');
      button.href = '#';
      button.className = 'p-navgroup-link p-navgroup-link--iconic public-mode-button';
      button.setAttribute('title', 'Public Mode');
      button.setAttribute('aria-label', 'Public Mode');
  
      const icon = document.createElement('i');
      icon.setAttribute('aria-hidden', 'true');
      icon.className = 'fas fa-eye-slash';
      button.appendChild(icon);
  
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle(api);
      });
  
      // Find navigation group and insert button
      const navGroup = document.querySelector('.p-navgroup.p-discovery');
      if (navGroup) {
        const searchButton = navGroup.querySelector('.p-navgroup-link--search');
        if (searchButton) {
          navGroup.insertBefore(button, searchButton);
        } else {
          navGroup.appendChild(button);
        }
        this.state.button = button;
      }
    },
  
    // Setup keyboard shortcut
    setupKeyboardShortcut(api) {
      if (this.state.keyboardHandler) return;
      
      this.state.keyboardHandler = (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'P') {
          e.preventDefault();
          this.toggle(api);
        }
      };
      
      document.addEventListener('keydown', this.state.keyboardHandler);
    },
  
    // Remove keyboard shortcut
    removeKeyboardShortcut() {
      if (this.state.keyboardHandler) {
        document.removeEventListener('keydown', this.state.keyboardHandler);
        this.state.keyboardHandler = null;
      }
    },
  
    // Toggle public mode
    async toggle(api) {
      this.state.isActive = !this.state.isActive;
      
      // Update setting (which will trigger the watch handler)
      await api.settings.set('enabled', this.state.isActive);
      
      // Show notification if enabled
      if (api.settings.get('showNotifications')) {
        api.ui.createNotification({
          message: this.state.isActive ? 'Public Mode Activated' : 'Public Mode Deactivated',
          type: this.state.isActive ? 'success' : 'info',
          duration: 2000
        });
      }
    },
  
    // Update button appearance
    updateButtonState(api, isActive) {
      if (!this.state.button) return;
      
      this.state.button.classList.toggle('is-active', isActive);
      const icon = this.state.button.querySelector('i');
      if (icon) {
        icon.className = isActive ? 'fas fa-eye' : 'fas fa-eye-slash';
        this.state.button.setAttribute('title', isActive ? 'Exit Public Mode' : 'Public Mode');
        this.state.button.setAttribute('aria-label', isActive ? 'Exit Public Mode' : 'Public Mode');
      }
    },
  
    // Apply public mode styles and transformations
    applyPublicMode(api) {
      this.injectStyles(api);
      
      if (api.settings.get('replaceText')) {
        this.replaceText(api);
        
        // Watch for DOM changes and replace text in new content
        api.dom.observe('body', ({ type, element }) => {
          if (type === 'add' && this.state.isActive && api.settings.get('replaceText')) {
            this.replaceTextInElement(api, element);
          }
        });
      }
    },
  
    // Remove public mode
    removePublicMode(api) {
      api.dom.removeStyle('public-mode-styles');
      
      if (api.settings.get('replaceText')) {
        this.restoreText(api);
      }
    },
  
    // Update styles (when settings change)
    updateStyles(api) {
      api.dom.removeStyle('public-mode-styles');
      this.injectStyles(api);
    },
  
    // Inject CSS styles
    injectStyles(api) {
      const blur = api.settings.get('blurIntensity');
      const hideAvatars = api.settings.get('hideAvatars');
      const hideLogos = api.settings.get('hideLogos');
      const blurSignatures = api.settings.get('blurSignatures');
      
      let styles = '';
      
      // Avatar replacement
      if (hideAvatars) {
        styles += `
          .avatar img, .avatarWrapper img, .memberAvatar img,
          .structItem-iconContainer img, .message-avatar img, 
          .message-avatar-wrapper img, .listAvatar img {
            content: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E") !important;
            filter: none !important;
            width: auto !important;
            height: auto !important;
            object-fit: cover !important;
            background-color: #00000090 !important;
          }
        `;
      }
      
      // Logo hiding
      if (hideLogos) {
        styles += `
          .p-header-logo, .logo, .site-logo, .forum-logo,
          .navbar-brand, .header-logo, .banner, .top-banner {
            visibility: hidden !important;
            opacity: 0 !important;
          }
        `;
      }
      
      // Media blurring
      styles += `
        img:not(.avatar img):not(.avatarWrapper img):not(.memberAvatar img):not(.structItem-iconContainer img):not(.message-avatar img):not(.message-avatar-wrapper img):not(.listAvatar img):not(.emoji):not(.reaction-emoji):not([alt*="emoji"]):not([src*="emoji"]):not([class*="emoji"]):not([class*="icon"]):not([width="16"]):not([width="20"]):not([width="24"]):not([height="16"]):not([height="20"]):not([height="24"]):not([class*="reaction"]):not([class*="react"]), 
        video, canvas {
          filter: blur(${blur}px) !important;
          transition: filter 0.3s ease !important;
          object-fit: cover !important;
          overflow: hidden !important;
        }
        
        img:hover, video:hover, canvas:hover {
          filter: none !important;
        }
        
        iframe, embed, object {
          filter: blur(${Math.floor(blur * 0.66)}px) !important;
          transition: filter 0.3s ease !important;
        }
        
        iframe:hover, embed:hover, object:hover {
          filter: none !important;
        }
      `;
      
      // Signature blurring
      if (blurSignatures) {
        styles += `
          .message-signature, .signature, .bbCodeBlock--signature {
            filter: blur(${Math.floor(blur * 0.25)}px) !important;
            transition: filter 0.3s ease !important;
          }
          
          .message-signature:hover, .signature:hover, .bbCodeBlock--signature:hover {
            filter: none !important;
          }
        `;
      }
      
      api.dom.style(styles, 'public-mode-styles');
    },
  
    // Replace sensitive text
    replaceText(api) {
      const textReplacements = [
        { from: /Looksmaxing/gi, to: 'Finance' },
        { from: /Looksmaxxing/gi, to: 'Finance' },
        { from: /Looksmax/gi, to: 'Finance' },
        { from: /nigger/gi, to: 'Black' }
      ];
  
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (parent && (
              parent.tagName === 'INPUT' ||
              parent.tagName === 'TEXTAREA' ||
              parent.isContentEditable ||
              parent.closest('[contenteditable="true"]')
            )) {
              return NodeFilter.FILTER_REJECT;
            }
  
            return /(looksmaxxing|looksmax|nigger)/i.test(node.textContent) ?
              NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        }
      );
  
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
  
      textNodes.forEach(textNode => {
        if (!this.state.processedNodes.has(textNode)) {
          this.state.originalTextContent.set(textNode, textNode.textContent);
          
          let content = textNode.textContent;
          textReplacements.forEach(({ from, to }) => {
            content = content.replace(from, to);
          });
          
          textNode.textContent = content;
          this.state.processedNodes.add(textNode);
        }
      });
    },
  
    // Replace text in a specific element
    replaceTextInElement(api, element) {
      const textReplacements = [
        { from: /Looksmaxing/gi, to: 'Finance' },
        { from: /Looksmaxxing/gi, to: 'Finance' },
        { from: /Looksmax/gi, to: 'Finance' },
        { from: /nigger/gi, to: 'Black' }
      ];
  
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (parent && (
              parent.tagName === 'INPUT' ||
              parent.tagName === 'TEXTAREA' ||
              parent.isContentEditable
            )) {
              return NodeFilter.FILTER_REJECT;
            }
  
            return /(looksmaxxing|looksmax|nigger)/i.test(node.textContent) ?
              NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        }
      );
  
      let node;
      while (node = walker.nextNode()) {
        if (!this.state.processedNodes.has(node)) {
          this.state.originalTextContent.set(node, node.textContent);
          
          let content = node.textContent;
          textReplacements.forEach(({ from, to }) => {
            content = content.replace(from, to);
          });
          
          node.textContent = content;
          this.state.processedNodes.add(node);
        }
      }
    },
  
    // Restore original text
    restoreText(api) {
      this.state.originalTextContent.forEach((originalText, textNode) => {
        if (textNode.parentNode) {
          textNode.textContent = originalText;
        }
      });
      
      this.state.originalTextContent.clear();
      this.state.processedNodes = new WeakSet();
    }
  };