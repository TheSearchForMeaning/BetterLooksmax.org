/**
 * Validators Utility
 * 
 * Schema validation, type checking, and sanitization functions.
 */

export const Validators = {
  /**
   * Validate value against type
   * @param {*} value - Value to validate
   * @param {string} type - Expected type
   * @returns {boolean} Is valid
   */
  validateType(value, type) {
    switch (type) {
      case 'boolean':
        return typeof value === 'boolean';
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'function':
        return typeof value === 'function';
      case 'null':
        return value === null;
      case 'undefined':
        return value === undefined;
      default:
        return true;
    }
  },

  /**
   * Validate number range
   * @param {number} value - Value to validate
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {boolean} Is valid
   */
  validateRange(value, min, max) {
    if (typeof value !== 'number') return false;
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return true;
  },

  /**
   * Validate string length
   * @param {string} value - Value to validate
   * @param {number} min - Minimum length
   * @param {number} max - Maximum length
   * @returns {boolean} Is valid
   */
  validateLength(value, min, max) {
    if (typeof value !== 'string') return false;
    if (min !== undefined && value.length < min) return false;
    if (max !== undefined && value.length > max) return false;
    return true;
  },

  /**
   * Validate value against enum
   * @param {*} value - Value to validate
   * @param {Array} enumValues - Valid values
   * @returns {boolean} Is valid
   */
  validateEnum(value, enumValues) {
    return enumValues.includes(value);
  },

  /**
   * Validate using regex pattern
   * @param {string} value - Value to validate
   * @param {RegExp} pattern - Regex pattern
   * @returns {boolean} Is valid
   */
  validatePattern(value, pattern) {
    if (typeof value !== 'string') return false;
    return pattern.test(value);
  },

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Is valid
   */
  validateEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return this.validatePattern(email, pattern);
  },

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} Is valid
   */
  validateURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate color format (hex, rgb, rgba)
   * @param {string} color - Color to validate
   * @returns {boolean} Is valid
   */
  validateColor(color) {
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const rgbPattern = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
    const rgbaPattern = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)$/;
    
    return hexPattern.test(color) || rgbPattern.test(color) || rgbaPattern.test(color);
  },

  /**
   * Sanitize HTML string
   * @param {string} html - HTML to sanitize
   * @param {object} options - Sanitization options
   * @returns {string} Sanitized HTML
   */
  sanitizeHTML(html, options = {}) {
    const {
      allowedTags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      allowedAttributes = { a: ['href'] }
    } = options;

    const div = document.createElement('div');
    div.innerHTML = html;

    const sanitize = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tagName = node.tagName.toLowerCase();
      
      if (!allowedTags.includes(tagName)) {
        return Array.from(node.childNodes).map(sanitize).join('');
      }

      const attributes = allowedAttributes[tagName] || [];
      const sanitizedAttrs = Array.from(node.attributes)
        .filter(attr => attributes.includes(attr.name))
        .map(attr => `${attr.name}="${attr.value}"`)
        .join(' ');

      const children = Array.from(node.childNodes).map(sanitize).join('');
      
      return `<${tagName}${sanitizedAttrs ? ' ' + sanitizedAttrs : ''}>${children}</${tagName}>`;
    };

    return Array.from(div.childNodes).map(sanitize).join('');
  },

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Validate object against schema
   * @param {object} obj - Object to validate
   * @param {object} schema - Schema definition
   * @returns {object} {valid: boolean, errors: string[]}
   */
  validateSchema(obj, schema) {
    const errors = [];

    Object.entries(schema).forEach(([key, definition]) => {
      const value = obj[key];
      const { type, required, min, max, enum: enumValues, pattern, validator } = definition;

      // Check required
      if (required && value === undefined) {
        errors.push(`Missing required field: ${key}`);
        return;
      }

      // Skip if not required and undefined
      if (value === undefined) {
        return;
      }

      // Type validation
      if (type && !this.validateType(value, type)) {
        errors.push(`Invalid type for ${key}: expected ${type}`);
        return;
      }

      // Range validation for numbers
      if (type === 'number' && !this.validateRange(value, min, max)) {
        errors.push(`Value for ${key} out of range (${min}-${max})`);
      }

      // Length validation for strings
      if (type === 'string' && !this.validateLength(value, min, max)) {
        errors.push(`Length for ${key} invalid (${min}-${max})`);
      }

      // Enum validation
      if (enumValues && !this.validateEnum(value, enumValues)) {
        errors.push(`Invalid value for ${key}: must be one of ${enumValues.join(', ')}`);
      }

      // Pattern validation
      if (pattern && !this.validatePattern(value, pattern)) {
        errors.push(`Value for ${key} does not match pattern`);
      }

      // Custom validator
      if (validator && typeof validator === 'function') {
        const result = validator(value);
        if (!result) {
          errors.push(`Custom validation failed for ${key}`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Deep clone object
   * @param {*} obj - Object to clone
   * @returns {*} Cloned object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }

    if (obj instanceof Object) {
      const cloned = {};
      Object.keys(obj).forEach(key => {
        cloned[key] = this.deepClone(obj[key]);
      });
      return cloned;
    }
  },

  /**
   * Check if two objects are equal (deep comparison)
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} Are equal
   */
  deepEqual(a, b) {
    if (a === b) return true;
    
    if (a === null || b === null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => 
      keysB.includes(key) && this.deepEqual(a[key], b[key])
    );
  }
};

export default Validators;
