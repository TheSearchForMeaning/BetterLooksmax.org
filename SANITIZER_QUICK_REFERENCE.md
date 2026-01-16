# Security Sanitizer - Quick Reference Card

## 🔒 Availability

```javascript
if (api.sanitizer) {
  // Sanitizer is available
}
```

## 📋 Core Methods

### HTML Sanitization
```javascript
// Remove dangerous HTML, keep safe formatting
const clean = api.sanitizer.sanitizeHTML(userHTML);
element.innerHTML = clean;
```

### CSS Sanitization
```javascript
// Remove dangerous CSS properties and values
const clean = api.sanitizer.sanitizeCSS(userCSS);
api.dom.style('my-styles', clean);
```

### Text Escaping
```javascript
// Convert < > & to entities
const safe = api.sanitizer.sanitizeText(username);
element.innerHTML = `User: ${safe}`;
```

### Safe DOM Insertion
```javascript
// No HTML parsing at all
api.sanitizer.safeInsertText(element, plainText);
```

## 🚫 What Gets Blocked

### HTML
- `<script>` tags
- Event handlers (`onclick`, `onerror`, etc.)
- `javascript:` URLs
- `<iframe>`, `<object>`, `<embed>`
- `style` attributes

### CSS
- `javascript:` URLs
- `expression()` (IE)
- `behavior:` (IE)
- `-moz-binding`
- External HTTP/HTTPS URLs
- Non-image data URIs

## ✅ What Passes Through

### HTML
- Text formatting: `<b>`, `<i>`, `<u>`, `<strong>`, `<em>`
- Structure: `<div>`, `<p>`, `<span>`, `<br>`
- Lists: `<ul>`, `<ol>`, `<li>`
- Links: `<a href="https://...">` (safe protocols only)
- Images: `<img src="...">` (safe protocols only)

### CSS
- Colors, fonts, spacing
- Layout properties
- Safe backgrounds
- Relative/absolute URLs (local)
- Data URIs for images only

## 🎯 Common Patterns

### Forum Post
```javascript
document.querySelectorAll('.post').forEach(post => {
  post.innerHTML = api.sanitizer.sanitizeHTML(post.innerHTML);
});
```

### User Settings
```javascript
const css = api.settings.get('customCSS');
api.dom.style('user', api.sanitizer.sanitizeCSS(css));
```

### Username Display
```javascript
const span = document.createElement('span');
api.sanitizer.safeInsertText(span, username);
```

### Notification
```javascript
api.ui.createNotification({
  message: api.sanitizer.sanitizeText(userMessage),
  type: 'info'
});
```

## ⚡ Performance Tips

1. **Cache sanitized content** - Don't re-sanitize the same content
2. **Use right tool** - `safeInsertText()` for plain text, not `sanitizeHTML()`
3. **Sanitize once** - At the input boundary, not repeatedly

## 🧪 Quick Test

```javascript
start(api) {
  // Should block script
  console.assert(
    api.sanitizer.sanitizeHTML('<script>x</script>') === '',
    'Script blocked'
  );
  
  // Should allow safe tags
  console.assert(
    api.sanitizer.sanitizeHTML('<b>text</b>') === '<b>text</b>',
    'Safe HTML passed'
  );
  
  api.logger.info('✅ Sanitizer working');
}
```

## 📚 Full Documentation

See `docs/security-sanitizer-guide.md` for complete API reference and examples.

## 🔗 Version

- **DOMPurify:** 3.3.1
- **CVE Patches:** CVE-2025-48050 (fixed in 3.2.6+)
- **License:** Apache 2.0 / MPL 2.0
