# Security Sanitizer Integration

## Overview

The BetterLooksmax framework now includes a comprehensive security sanitizer module powered by **DOMPurify v3.3.1** to prevent XSS and injection attacks.

## What Was Added

### Files Created

1. **`utils/dompurify.min.js`** (23KB)
   - DOMPurify v3.3.1 library
   - Industry-standard HTML/CSS sanitizer
   - Protects against XSS, script injection, and CSS injection

2. **`utils/sanitizer.js`** (9KB)
   - BetterLooksmax sanitizer wrapper
   - Provides forum-friendly sanitization policies
   - Multiple layers of security checks
   - Handles encoded attack patterns

3. **`docs/security-sanitizer-guide.md`** (Documentation)
   - Complete usage guide
   - API reference with examples
   - Best practices
   - Security considerations

### Files Modified

1. **`manifest.json`**
   - Added `utils/dompurify.min.js` to web_accessible_resources
   - Added `utils/sanitizer.js` to web_accessible_resources

2. **`src/content-loader.js`**
   - Loads DOMPurify before framework initialization
   - Loads sanitizer module after DOMPurify
   - Ensures security layer is available before any plugins run

3. **`src/api/PluginAPI.js`**
   - Added `api.sanitizer` object for plugins
   - Exposes all sanitizer methods through plugin API
   - Graceful fallback if sanitizer fails to load

4. **`plugins/plugin-template/index.js`**
   - Added sanitizer usage examples
   - Demonstrates safe content handling

## API Surface for Plugins

All plugins now have access to `api.sanitizer` with the following methods:

### Core Methods

```javascript
// HTML sanitization
api.sanitizer.sanitizeHTML(html)

// CSS sanitization
api.sanitizer.sanitizeCSS(css)

// Text escaping
api.sanitizer.sanitizeText(text)
api.sanitizer.escapeText(text)

// Safe DOM insertion
api.sanitizer.safeInsertText(element, text)
api.sanitizer.safeInsertFormattedText(selection, formattedText)

// Validation
api.sanitizer.isSafeCSSproperty(property)
api.sanitizer.isSafeCSSValue(value)
```

## Quick Start for Plugin Developers

### Example 1: Sanitize User Content

```javascript
export default {
  id: 'my-plugin',
  name: 'My Plugin',
  
  start(api) {
    const userHTML = getUserInput();
    
    // Sanitize before displaying
    const safeHTML = api.sanitizer.sanitizeHTML(userHTML);
    element.innerHTML = safeHTML;
  }
}
```

### Example 2: Safe CSS Injection

```javascript
start(api) {
  const userCSS = api.settings.get('customCSS');
  
  // Sanitize user CSS
  const safeCSS = api.sanitizer.sanitizeCSS(userCSS);
  
  // Inject safely
  api.dom.style('user-styles', safeCSS);
}
```

### Example 3: Plain Text Display

```javascript
start(api) {
  const username = getUserName();
  const userSpan = document.createElement('span');
  
  // Safe text insertion (no HTML)
  api.sanitizer.safeInsertText(userSpan, username);
}
```

## Security Features

### HTML Sanitization

**Allowed:**
- Safe formatting tags (b, i, u, strong, em, span, etc.)
- Structure tags (div, p, br, blockquote, etc.)
- Lists, tables, headings
- Images and links (with protocol filtering)

**Blocked:**
- All script tags
- All event handlers (onclick, onerror, etc.)
- Dangerous protocols (javascript:, data:text/html, vbscript:, etc.)
- Embedded content (iframe, object, embed)
- Meta tags and style attributes

### CSS Sanitization

**Removes:**
- External URLs (http://, https://)
- JavaScript expressions and eval
- Behavior/binding properties
- @import statements
- Non-image data URIs
- Encoded attack patterns (HTML entities, URL encoding, Unicode escapes)

### Advanced Protection

The sanitizer includes multiple layers:

1. **DOMPurify** - Industry-standard HTML/CSS sanitization
2. **Normalization** - Decodes encoded attacks (HTML entities, URL encoding, Unicode)
3. **Pattern Matching** - Blocks dangerous keywords even if encoded
4. **Protocol Filtering** - Restricts allowed URL schemes
5. **Property Filtering** - Removes dangerous CSS properties

## Loading Sequence

The framework loads in this order:

```
1. content-loader.js (Chrome content script)
   ↓
2. DOMPurify library (utils/dompurify.min.js)
   ↓
3. Sanitizer wrapper (utils/sanitizer.js)
   ↓
4. Framework core (src/content.js)
   ↓
5. Plugins (with api.sanitizer available)
```

This ensures all plugins have access to the sanitizer from their first lifecycle hook.

## Testing

The sanitizer will log its initialization:

```
BetterLooksmax Sanitizer: Initialized successfully with DOMPurify v3.3.1
```

If you see this message in the console, the sanitizer is ready to use.

### Test Cases

Run these in your plugin's `start()` method to verify:

```javascript
start(api) {
  if (!api.sanitizer) {
    api.utils.logger.error('Sanitizer not available!');
    return;
  }
  
  // Test XSS blocking
  const test1 = api.sanitizer.sanitizeHTML('<script>alert(1)</script>');
  console.assert(test1 === '', 'Script tag should be removed');
  
  // Test safe HTML
  const test2 = api.sanitizer.sanitizeHTML('<b>Bold</b>');
  console.assert(test2 === '<b>Bold</b>', 'Safe tags should pass through');
  
  // Test CSS injection
  const test3 = api.sanitizer.sanitizeCSS('color: red; behavior: url(evil);');
  console.assert(!test3.includes('behavior'), 'Dangerous CSS should be removed');
  
  api.utils.logger.info('Sanitizer tests passed!');
}
```

## Performance Considerations

- **Sanitization has overhead**: Cache sanitized content when possible
- **Use appropriate method**: 
  - Plain text → `safeInsertText()` or `textContent`
  - User HTML → `sanitizeHTML()`
  - User CSS → `sanitizeCSS()`
- **Don't over-sanitize**: Sanitize once at the input boundary

## Browser Compatibility

- Chrome/Edge: Full support (Manifest V3)
- Firefox: Full support (Manifest V2 compatibility mode)
- DOMPurify version: 3.3.1 (includes patches for CVE-2025-48050)

## Migration Guide

If you have existing plugins that handle user content:

### Before

```javascript
// ❌ INSECURE
element.innerHTML = userContent;
element.style = userCSS;
```

### After

```javascript
// ✅ SECURE
element.innerHTML = api.sanitizer.sanitizeHTML(userContent);
const safeCSS = api.sanitizer.sanitizeCSS(userCSS);
api.dom.style('my-styles', safeCSS);
```

## Documentation

For complete documentation, see:

- **`docs/security-sanitizer-guide.md`** - Full API reference and examples
- **`plugins/plugin-template/index.js`** - Working code examples

## Support

If you encounter issues:

1. Check browser console for error messages
2. Verify DOMPurify loaded: `console.log(typeof DOMPurify)`
3. Verify sanitizer loaded: `console.log(typeof window.BetterLooksmaxSanitizer)`
4. Check plugin has access: `console.log(typeof api.sanitizer)`

## Future Enhancements

Potential additions:

- [ ] URL validation helper
- [ ] BBCode parser with sanitization
- [ ] Markdown parser with sanitization
- [ ] Image upload validation
- [ ] Content policy configurator
- [ ] Security audit logging

## Credits

- **DOMPurify** by Cure53: https://github.com/cure53/DOMPurify
- **CVE-2025-48050 Patch**: Fixed in DOMPurify 3.2.6+
- Licensed under Apache License 2.0 / MPL 2.0
