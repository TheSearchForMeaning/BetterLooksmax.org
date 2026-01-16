/**
 * BetterLooksmax.org Security Sanitizer Module
 * Provides CSS and HTML sanitization using DOMPurify
 * Prevents XSS and CSS injection attacks
 */

(function() {
    'use strict';
    
    // Ensure DOMPurify is available
    if (typeof DOMPurify === 'undefined') {
        console.error('BetterLooksmax Sanitizer: DOMPurify library not loaded!');
        return;
    }
    
    // Create global sanitizer object
    window.BetterLooksmaxSanitizer = {
        
        /**
         * Sanitize CSS to prevent injection attacks
         * Removes dangerous properties like url(), expression(), behavior, -moz-binding
         * @param {string} css - Raw CSS input
         * @returns {string} - Sanitized CSS
         */
        sanitizeCSS: function(css) {
            if (!css || typeof css !== 'string') {
                return '';
            }
            
            try {
                // First, wrap CSS in a style tag and let DOMPurify handle it
                const wrapped = `<style>${css}</style>`;
                const sanitized = DOMPurify.sanitize(wrapped, {
                    TAGS: ['style'],
                    FORBID_ATTR: ['*'],
                    KEEP_CONTENT: true
                });
                
                // Extract the CSS content
                const match = sanitized.match(/<style>(.*?)<\/style>/s);
                let cleanCSS = match ? match[1] : css;
                
                // Additional security layer - check normalized content for dangerous patterns
                // Normalize to detect encoded attacks
                const normalized = cleanCSS
                    .toLowerCase()
                    // Decode HTML entities
                    .replace(/&#x([0-9a-f]+);?/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
                    .replace(/&#([0-9]+);?/gi, (m, dec) => String.fromCharCode(parseInt(dec, 10)))
                    // Decode URL encoding
                    .replace(/%([0-9a-f]{2})/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
                    // Remove whitespace variations
                    .replace(/[\s\t\n\r\f\0]+/g, ' ')
                    // Decode CSS unicode escapes
                    .replace(/\\([0-9a-f]{1,6})\s?/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
                
                // Check for dangerous patterns in normalized content
                const dangerous = [
                    'javascript:',
                    'vbscript:',
                    'livescript:',
                    'mocha:',
                    'expression(',
                    'import(',
                    'behavior:',
                    '-moz-binding',
                    'data:text/html',
                    'data:application',
                    '<script',
                    'onclick',
                    'onerror',
                    'onload',
                    'eval(',
                    'alert(',
                    'document.cookie',
                    'window.location'
                ];
                
                // If normalized content contains dangerous patterns, block it
                for (const pattern of dangerous) {
                    if (normalized.includes(pattern)) {
                        console.warn('BetterLooksmax Sanitizer: Blocked dangerous CSS pattern:', pattern);
                        // Return empty or safe fallback
                        return '/* Dangerous content removed */';
                    }
                }
                
                // Additional filters for specific cases
                cleanCSS = cleanCSS
                    // Remove ALL external URLs - only allow relative paths and data URIs for images
                    .replace(/url\s*\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi, 'url()')
                    // Remove ALL @import statements for security
                    .replace(/@import\s+[^;]+;/gi, '/* @import removed for security */')
                    // Remove data URIs that aren't images
                    .replace(/url\s*\(\s*["']?data:(?!image\/(?:png|jpg|jpeg|gif|webp|svg\+xml))[^"')]*["']?\s*\)/gi, 'url()');
                
                return cleanCSS;
                
            } catch (error) {
                console.error('BetterLooksmax Sanitizer: CSS sanitization failed', error);
                return '';
            }
        },
        
        /**
         * Sanitize HTML content to prevent XSS
         * Only allows safe formatting tags
         * @param {string} html - Raw HTML input
         * @returns {string} - Sanitized HTML
         */
        sanitizeHTML: function(html) {
            if (!html || typeof html !== 'string') {
                return '';
            }
            
            try {
                // Configure DOMPurify for HTML sanitization with forum-friendly settings
                const cleaned = DOMPurify.sanitize(html, {
                    // Allow common forum formatting tags
                    ALLOWED_TAGS: [
                        // Text formatting
                        'b', 'i', 'u', 'strong', 'em', 'span', 'mark', 's', 'del', 'ins', 'sub', 'sup',
                        // Structure
                        'br', 'p', 'div', 'blockquote', 'pre', 'code', 'kbd', 'samp', 'var',
                        // Lists
                        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
                        // Tables
                        'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
                        // Headings
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                        // Media (with restrictions)
                        'img', 'picture', 'source',
                        // Links
                        'a',
                        // Semantic
                        'article', 'section', 'nav', 'aside', 'header', 'footer', 'main',
                        // Other
                        'hr', 'abbr', 'cite', 'q', 'dfn', 'time'
                    ],
                    // Allow safe attributes
                    ALLOWED_ATTR: [
                        // Global attributes
                        'class', 'id', 'title', 'dir', 'lang',
                        // Link attributes
                        'href', 'target', 'rel',
                        // Image attributes
                        'src', 'alt', 'width', 'height', 'loading',
                        // Table attributes
                        'colspan', 'rowspan', 'headers', 'scope',
                        // Other
                        'datetime', 'cite', 'type'
                    ],
                    // Block dangerous protocols
                    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
                    // Keep text content even if tags are removed
                    KEEP_CONTENT: true,
                    // No data attributes (can be used for attacks)
                    ALLOW_DATA_ATTR: false,
                    // Safe for DOM
                    SANITIZE_DOM: true,
                    // Remove dangerous elements completely
                    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'base', 'meta'],
                    // Remove dangerous attributes
                    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'style']
                });
                
                return cleaned;
                
            } catch (error) {
                console.error('BetterLooksmax Sanitizer: HTML sanitization failed', error);
                return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }); // Fallback: strip all HTML
            }
        },
        
        /**
         * Escape text for safe insertion as HTML
         * Converts special characters to HTML entities
         * @param {string} text - Plain text input
         * @returns {string} - Escaped text safe for innerHTML
         */
        escapeText: function(text) {
            if (!text || typeof text !== 'string') {
                return '';
            }
            
            // Use browser's built-in escaping via textContent
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        /**
         * Safely insert text into an element
         * Uses textContent to avoid any HTML interpretation
         * @param {HTMLElement} element - Target element
         * @param {string} text - Text to insert
         */
        safeInsertText: function(element, text) {
            if (!element || !element.nodeType) {
                console.error('BetterLooksmax Sanitizer: Invalid element provided');
                return;
            }
            
            // Use textContent for completely safe text insertion
            element.textContent = text || '';
        },
        
        /**
         * Safely insert formatted text (BBCode) without HTML injection
         * @param {Selection} selection - Current text selection
         * @param {string} formattedText - BBCode formatted text
         */
        safeInsertFormattedText: function(selection, formattedText) {
            if (!selection || selection.rangeCount === 0) {
                console.error('BetterLooksmax Sanitizer: No valid selection');
                return;
            }
            
            try {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                
                // Insert as plain text to preserve BBCode without HTML interpretation
                const textNode = document.createTextNode(formattedText);
                range.insertNode(textNode);
                
                // Move cursor to end of inserted text
                range.setStartAfter(textNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                
            } catch (error) {
                console.error('BetterLooksmax Sanitizer: Failed to insert formatted text', error);
            }
        },
        
        /**
         * Validate if CSS property is safe
         * @param {string} property - CSS property name
         * @returns {boolean} - True if property is safe
         */
        isSafeCSSproperty: function(property) {
            const dangerousProperties = [
                'behavior',
                'expression',
                '-moz-binding',
                'binding',
                'javascript'
            ];
            
            const prop = property.toLowerCase();
            return !dangerousProperties.some(dangerous => prop.includes(dangerous));
        },
        
        /**
         * Validate if CSS value is safe
         * @param {string} value - CSS value
         * @returns {boolean} - True if value is safe
         */
        isSafeCSSValue: function(value) {
            const val = value.toLowerCase();
            
            // Check for dangerous patterns
            if (val.includes('javascript:') || 
                val.includes('expression(') ||
                val.includes('behavior:')) {
                return false;
            }
            
            // Check for suspicious URLs
            if (val.includes('url(')) {
                // Only allow data URLs for images
                const urlMatch = val.match(/url\s*\(\s*['"]?([^'")\s]+)/);
                if (urlMatch && urlMatch[1]) {
                    const url = urlMatch[1];
                    // Allow safe data URLs and relative paths
                    if (!url.startsWith('data:image/') && 
                        !url.startsWith('/') && 
                        !url.startsWith('./') && 
                        !url.startsWith('../')) {
                        return false;
                    }
                }
            }
            
            return true;
        },
        
        
        /**
         * Sanitize plain text by escaping HTML entities
         * @param {string} text - Raw text input
         * @returns {string} - Escaped text
         */
        sanitizeText: function(text) {
            if (!text) return '';
            if (typeof text !== 'string') return '';
            
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };
    
    // Silent initialization (log once in debug mode if needed)
    if (window.location.search.includes('debug=true')) {
      console.log('BetterLooksmax Sanitizer: Initialized with DOMPurify v' + DOMPurify.version);
    }
    
})();
