/**
 * DOM Utilities
 * 
 * Helper functions for DOM manipulation, element waiting, and observation.
 */

export const DOMUtils = {
  /**
   * Wait for an element to appear in the DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in milliseconds
   * @param {Element} root - Root element to search within
   * @returns {Promise<Element>} Found element
   */
  waitFor(selector, timeout = 5000, root = document) {
    return new Promise((resolve, reject) => {
      const existing = root.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = root.querySelector(selector);
        if (element) {
          obs.disconnect();
          clearTimeout(timeoutId);
          resolve(element);
        }
      });

      const timeoutId = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for selector: ${selector}`));
      }, timeout);

      observer.observe(root, {
        childList: true,
        subtree: true
      });
    });
  },

  /**
   * Wait for multiple elements
   * @param {string[]} selectors - Array of CSS selectors
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Element[]>} Array of found elements
   */
  async waitForAll(selectors, timeout = 5000) {
    return Promise.all(
      selectors.map(selector => this.waitFor(selector, timeout))
    );
  },

  /**
   * Observe elements matching selector
   * @param {string} selector - CSS selector
   * @param {Function} callback - Called when element is added/removed
   * @param {object} options - Observer options
   * @returns {Function} Unobserve function
   */
  observe(selector, callback, options = {}) {
    const {
      onAdd = true,
      onRemove = false,
      root = document.body
    } = options;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (onAdd && mutation.addedNodes.length) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches(selector)) {
                callback({ type: 'add', element: node });
              }
              // Check children
              node.querySelectorAll(selector).forEach(child => {
                callback({ type: 'add', element: child });
              });
            }
          });
        }

        if (onRemove && mutation.removedNodes.length) {
          mutation.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches(selector)) {
                callback({ type: 'remove', element: node });
              }
              // Check children
              node.querySelectorAll(selector).forEach(child => {
                callback({ type: 'remove', element: child });
              });
            }
          });
        }
      });
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  },

  /**
   * Inject element into DOM
   * @param {Element} element - Element to inject
   * @param {string} position - Position: 'before', 'after', 'prepend', 'append'
   * @param {Element} reference - Reference element
   */
  inject(element, position, reference) {
    switch (position) {
      case 'before':
        reference.parentNode.insertBefore(element, reference);
        break;
      case 'after':
        reference.parentNode.insertBefore(element, reference.nextSibling);
        break;
      case 'prepend':
        reference.insertBefore(element, reference.firstChild);
        break;
      case 'append':
        reference.appendChild(element);
        break;
      default:
        throw new Error(`Invalid position: ${position}`);
    }
  },

  /**
   * Remove element from DOM
   * @param {Element} element - Element to remove
   */
  remove(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  },

  /**
   * Inject CSS styles
   * @param {string} css - CSS string
   * @param {string} id - Optional ID for the style element
   * @returns {HTMLStyleElement} Created style element
   */
  style(css, id = null) {
    const style = document.createElement('style');
    style.textContent = css;
    if (id) {
      style.id = id;
    }
    document.head.appendChild(style);
    return style;
  },

  /**
   * Remove injected styles
   * @param {string} id - ID of the style element
   */
  removeStyle(id) {
    const style = document.getElementById(id);
    if (style) {
      style.remove();
    }
  },

  /**
   * Create element from HTML string
   * @param {string} html - HTML string
   * @returns {Element} Created element
   */
  createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  },

  /**
   * Check if element is visible
   * @param {Element} element - Element to check
   * @returns {boolean} Is visible
   */
  isVisible(element) {
    return !!(
      element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length
    );
  },

  /**
   * Get element position relative to viewport
   * @param {Element} element - Element to get position of
   * @returns {object} Position {top, left, bottom, right, width, height}
   */
  getPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height
    };
  },

  /**
   * Scroll element into view smoothly
   * @param {Element} element - Element to scroll to
   * @param {object} options - Scroll options
   */
  scrollIntoView(element, options = {}) {
    const {
      behavior = 'smooth',
      block = 'start',
      inline = 'nearest'
    } = options;

    element.scrollIntoView({ behavior, block, inline });
  },

  /**
   * Add class with optional delay
   * @param {Element} element - Element to add class to
   * @param {string} className - Class name
   * @param {number} delay - Delay in milliseconds
   */
  addClass(element, className, delay = 0) {
    if (delay > 0) {
      setTimeout(() => element.classList.add(className), delay);
    } else {
      element.classList.add(className);
    }
  },

  /**
   * Remove class with optional delay
   * @param {Element} element - Element to remove class from
   * @param {string} className - Class name
   * @param {number} delay - Delay in milliseconds
   */
  removeClass(element, className, delay = 0) {
    if (delay > 0) {
      setTimeout(() => element.classList.remove(className), delay);
    } else {
      element.classList.remove(className);
    }
  },

  /**
   * Toggle class
   * @param {Element} element - Element to toggle class on
   * @param {string} className - Class name
   * @param {boolean} force - Force add (true) or remove (false)
   */
  toggleClass(element, className, force) {
    element.classList.toggle(className, force);
  },

  /**
   * Get all text nodes within element
   * @param {Element} element - Root element
   * @returns {Text[]} Array of text nodes
   */
  getTextNodes(element) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }
    return textNodes;
  },

  /**
   * Replace text content in element
   * @param {Element} element - Element to modify
   * @param {RegExp|string} search - Text to search for
   * @param {string} replace - Replacement text
   */
  replaceText(element, search, replace) {
    const textNodes = this.getTextNodes(element);
    textNodes.forEach(node => {
      if (typeof search === 'string') {
        node.textContent = node.textContent.replace(new RegExp(search, 'g'), replace);
      } else {
        node.textContent = node.textContent.replace(search, replace);
      }
    });
  },

  /**
   * Debounce function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
};

export default DOMUtils;
