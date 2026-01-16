# Security Sanitizer Guide

## Overview

The BetterLooksmax framework includes a comprehensive security sanitizer module powered by **DOMPurify v3.3.1** to prevent XSS and injection attacks. All plugins have access to this sanitizer through the Plugin API.

## Why Use the Sanitizer?

When working with user-generated content, untrusted HTML, or dynamically created content, you must sanitize inputs to prevent:

- **XSS (Cross-Site Scripting)** attacks
- **CSS injection** attacks
- **Script injection** through URLs
- **Event handler injection** (onclick, onerror, etc.)
- **Protocol injection** (javascript:, data:, etc.)

## Available Methods

### API Access

All sanitizer methods are available through `api.sanitizer` in your plugin:

```javascript
export default {
  id: 'my-plugin',
  name: 'My Plugin',
  
  start(api) {
    // Access sanitizer methods
    const cleanHTML = api.sanitizer.sanitizeHTML('<div>Hello</div>');
    const cleanCSS = api.sanitizer.sanitizeCSS('color: red;');
  }
}
```

### HTML Sanitization

#### `sanitizeHTML(html)`

Sanitizes HTML content while preserving safe formatting tags commonly used in forums.

**Allowed Tags:**
- Text formatting: `b`, `i`, `u`, `strong`, `em`, `span`, `mark`, `s`, `del`, `ins`, `sub`, `sup`
- Structure: `br`, `p`, `div`, `blockquote`, `pre`, `code`, `kbd`, `samp`, `var`
- Lists: `ul`, `ol`, `li`, `dl`, `dt`, `dd`
- Tables: `table`, `thead`, `tbody`, `tfoot`, `tr`, `td`, `th`, `caption`
- Headings: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- Media: `img`, `picture`, `source`
- Links: `a`
- Other: `hr`, `abbr`, `cite`, `q`, `dfn`, `time`

**Blocked:**
- All script tags
- All event handlers (onclick, onerror, etc.)
- Dangerous protocols (javascript:, data:text/html, etc.)
- Embedded content (iframe, object, embed)

**Example:**

```javascript
const userInput = '<script>alert("XSS")</script><b>Safe content</b>';
const clean = api.sanitizer.sanitizeHTML(userInput);
// Result: '<b>Safe content</b>'

const dangerousLink = '<a href="javascript:alert(1)">Click</a>';
const cleanLink = api.sanitizer.sanitizeHTML(dangerousLink);
// Result: '<a>Click</a>' (href removed)
```

### CSS Sanitization

#### `sanitizeCSS(css)`

Sanitizes CSS to remove dangerous patterns while preserving safe styles.

**Removes:**
- External URLs (http://, https://)
- JavaScript expressions
- Behavior/binding properties
- @import statements
- Non-image data URIs
- Encoded attack patterns

**Example:**

```javascript
const dangerousCSS = `
  background: url('javascript:alert(1)');
  color: red;
  -moz-binding: url('data:text/xml...');
`;

const cleanCSS = api.sanitizer.sanitizeCSS(dangerousCSS);
// Result: 'color: red;' (dangerous properties removed)

const safeCSS = `
  color: blue;
  font-size: 16px;
  background-image: url('/images/bg.png');
`;

const clean = api.sanitizer.sanitizeCSS(safeCSS);
// Result: Same CSS (all safe)
```

### Text Sanitization

#### `sanitizeText(text)` / `escapeText(text)`

Converts special characters to HTML entities for safe insertion.

**Example:**

```javascript
const username = '<script>alert(1)</script>';
const escaped = api.sanitizer.sanitizeText(username);
// Result: '&lt;script&gt;alert(1)&lt;/script&gt;'

// Safe to use in innerHTML:
element.innerHTML = `User: ${escaped}`;
```

#### `safeInsertText(element, text)`

Safely inserts plain text into an element using `textContent` (no HTML interpretation).

**Example:**

```javascript
const userComment = 'Hello <b>World</b>';
const commentDiv = document.createElement('div');

// Safe insertion - no HTML parsing
api.sanitizer.safeInsertText(commentDiv, userComment);
// Result: "Hello <b>World</b>" displayed as plain text
```

### BBCode/Formatted Text

#### `safeInsertFormattedText(selection, formattedText)`

Safely inserts BBCode or formatted text into a text selection without HTML interpretation.

**Example:**

```javascript
const selection = window.getSelection();
const bbCode = '[b]Bold text[/b] with [url=http://example.com]link[/url]';

api.sanitizer.safeInsertFormattedText(selection, bbCode);
// Inserts as plain text, preserving BBCode syntax
```

### Validation Methods

#### `isSafeCSSproperty(property)`

Checks if a CSS property name is safe.

**Example:**

```javascript
api.sanitizer.isSafeCSSproperty('color'); // true
api.sanitizer.isSafeCSSproperty('behavior'); // false
api.sanitizer.isSafeCSSproperty('-moz-binding'); // false
```

#### `isSafeCSSValue(value)`

Checks if a CSS value is safe.

**Example:**

```javascript
api.sanitizer.isSafeCSSValue('red'); // true
api.sanitizer.isSafeCSSValue('url(/image.png)'); // true
api.sanitizer.isSafeCSSValue('url(javascript:alert(1))'); // false
api.sanitizer.isSafeCSSValue('expression(alert(1))'); // false
```

## Best Practices

### 1. Always Sanitize User Input

```javascript
// ❌ DANGEROUS
element.innerHTML = userInput;

// ✅ SAFE
element.innerHTML = api.sanitizer.sanitizeHTML(userInput);
```

### 2. Use textContent for Plain Text

```javascript
// ❌ OVERKILL (and slower)
element.innerHTML = api.sanitizer.sanitizeText(plainText);

// ✅ BETTER
api.sanitizer.safeInsertText(element, plainText);

// ✅ ALSO GOOD
element.textContent = plainText;
```

### 3. Sanitize CSS Before Injection

```javascript
// ❌ DANGEROUS
api.dom.style('my-styles', userCSS);

// ✅ SAFE
const cleanCSS = api.sanitizer.sanitizeCSS(userCSS);
api.dom.style('my-styles', cleanCSS);
```

### 4. Validate Before Applying

```javascript
// Check before using dynamic CSS
if (api.sanitizer.isSafeCSSValue(cssValue)) {
  element.style.setProperty(property, cssValue);
} else {
  api.logger.warn('Unsafe CSS value blocked:', cssValue);
}
```

### 5. Layer Your Security

```javascript
// Multiple layers of protection
const processUserContent = (content) => {
  // 1. Sanitize HTML
  let clean = api.sanitizer.sanitizeHTML(content);
  
  // 2. Additional custom validation
  if (clean.includes('suspicious-pattern')) {
    clean = api.sanitizer.sanitizeText(clean); // Downgrade to plain text
  }
  
  // 3. Apply with safe DOM methods
  const container = document.createElement('div');
  container.innerHTML = clean;
  
  return container;
};
```

## Common Use Cases

### Forum Post Rendering

```javascript
start(api) {
  api.hooks.register('dom:ready', () => {
    const posts = document.querySelectorAll('.forum-post-content');
    
    posts.forEach(post => {
      // Get raw content
      const rawHTML = post.innerHTML;
      
      // Sanitize before displaying
      const cleanHTML = api.sanitizer.sanitizeHTML(rawHTML);
      post.innerHTML = cleanHTML;
    });
  });
}
```

### Custom Styling from User Settings

```javascript
settings: {
  customCSS: {
    type: 'text',
    description: 'Custom CSS',
    default: ''
  }
},

start(api) {
  const userCSS = api.settings.get('customCSS');
  
  // Sanitize user-provided CSS
  const cleanCSS = api.sanitizer.sanitizeCSS(userCSS);
  
  // Inject safely
  api.dom.style('user-custom-styles', cleanCSS);
}
```

### Username Display

```javascript
const displayUsername = (api, username) => {
  const userSpan = document.createElement('span');
  userSpan.className = 'username';
  
  // Safe text insertion
  api.sanitizer.safeInsertText(userSpan, username);
  
  return userSpan;
};
```

### Rich Text Editor Integration

```javascript
start(api) {
  const editor = document.querySelector('.rich-editor');
  
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    
    // Get pasted HTML
    const html = e.clipboardData.getData('text/html');
    
    // Sanitize before inserting
    const clean = api.sanitizer.sanitizeHTML(html);
    
    document.execCommand('insertHTML', false, clean);
  });
}
```

## Performance Considerations

- **Sanitization is not free**: Cache sanitized content when possible
- **Don't over-sanitize**: Use `textContent` or `safeInsertText` for plain text instead of sanitizing
- **Validate once**: Sanitize at the input boundary, not repeatedly

## Security Notes

1. **Always sanitize untrusted input** - Even if it looks safe, sanitize it
2. **Don't trust client-side validation alone** - This is a defense layer, not a security guarantee
3. **Keep DOMPurify updated** - The framework uses DOMPurify 3.3.1, which includes patches for recent vulnerabilities
4. **Report suspicious patterns** - If you see unusual patterns bypassing the sanitizer, report them

## Fallback Behavior

If the sanitizer module fails to load or DOMPurify is unavailable:

- `sanitizeHTML()` will strip all HTML tags (fallback to plain text)
- `sanitizeCSS()` will return an empty string
- `sanitizeText()` / `escapeText()` will still work (native browser functionality)
- Error messages will be logged to the console

The framework will log: `"BetterLooksmax Sanitizer: DOMPurify library not loaded!"`

## Testing Your Plugin's Security

```javascript
// Test with malicious inputs
const testCases = [
  '<script>alert(1)</script>',
  '<img src=x onerror="alert(1)">',
  '<a href="javascript:alert(1)">Link</a>',
  '<div style="background: url(javascript:alert(1))">Text</div>',
  '<iframe src="http://evil.com"></iframe>'
];

testCases.forEach(test => {
  const result = api.sanitizer.sanitizeHTML(test);
  console.log('Input:', test);
  console.log('Output:', result);
  console.log('Safe:', !result.includes('script') && !result.includes('javascript:'));
});
```

## Additional Resources

- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
