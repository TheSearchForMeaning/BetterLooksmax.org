# Plugin Template

This is a complete template for creating BetterLooksmax plugins.

## Quick Start

1. Copy this template directory to `plugins/your-plugin-name/`
2. Rename the directory and update the `id` field in `index.js`
3. Update the metadata (name, description, author, etc.)
4. Define your settings schema
5. Implement lifecycle methods (init, start, stop)
6. Register hooks as needed

## Plugin Structure

```
your-plugin-name/
├── index.js          # Main plugin file (required)
├── README.md         # Documentation (recommended)
├── styles.css        # Optional styles
└── icon.svg          # Optional icon
```

## Manifest Fields

### Required Fields
- `id`: Unique identifier (alphanumeric, hyphens, underscores)
- `name`: Display name
- `description`: Short description
- `version`: Semantic version (e.g., "1.0.0")

### Optional Fields
- `author`: Plugin author name
- `dependencies`: Array of required plugin IDs
- `optionalDependencies`: Array of optional plugin IDs
- `conflicts`: Array of incompatible plugin IDs
- `tags`: Array of tags for categorization
- `category`: Primary category
- `settings`: Settings schema object

## Settings Schema

### Supported Types

**Boolean** - Toggle switch
```javascript
{
  type: 'boolean',
  default: true,
  title: 'Enable Feature',
  description: 'Turn this on or off'
}
```

**String** - Text input
```javascript
{
  type: 'string',
  default: '',
  title: 'Text Field',
  placeholder: 'Enter text...',
  maxlength: 100
}
```

**Number** - Number input or slider
```javascript
{
  type: 'number',
  default: 50,
  min: 0,
  max: 100,
  step: 5,
  slider: true  // Use slider instead of input
}
```

**Select/Enum** - Dropdown
```javascript
{
  type: 'select',
  default: 'option1',
  enum: ['option1', 'option2', 'option3']
}
```

**Color** - Color picker
```javascript
{
  type: 'color',
  default: '#4CAF50'
}
```

### Advanced Features

**Custom Validation**
```javascript
{
  type: 'number',
  validator: (value) => value >= 5 && value <= 50
}
```

**Conditional Visibility**
```javascript
{
  type: 'string',
  visible: (settings) => settings.enableAdvanced === true
}
```

**Sections**
```javascript
{
  type: 'boolean',
  section: 'Advanced'  // Groups settings by section
}
```

## Lifecycle Methods

### init(api)
One-time initialization when plugin is first loaded.

### start(api)
Called when plugin is enabled. Register hooks, inject elements, etc.

### stop(api)
Called when plugin is disabled. Clean up injected elements.

### destroy(api)
Final cleanup when plugin is unloaded completely.

## Plugin API

### Settings
```javascript
api.settings.get(key)          // Get setting value
api.settings.set(key, value)   // Set setting value
api.settings.watch(key, fn)    // Watch for changes
api.settings.getAll()          // Get all settings
```

### Hooks
```javascript
api.hooks.register(name, handler, options)  // Register hook
api.hooks.unregister(name, handler)         // Unregister hook
api.hooks.emit(name, data, options)         // Emit hook
```

### DOM
```javascript
api.dom.waitFor(selector, timeout)          // Wait for element
api.dom.observe(selector, callback)         // Observe elements
api.dom.inject(element, position, ref)      // Inject element
api.dom.remove(element)                     // Remove element
api.dom.style(css, id)                      // Inject styles
api.dom.removeStyle(id)                     // Remove styles
api.dom.createElement(html)                 // Create from HTML
```

### Storage
```javascript
api.storage.get(key)                        // Get namespaced data
api.storage.set(key, value)                 // Set namespaced data
api.storage.remove(key)                     // Remove data
```

### UI Components
```javascript
api.ui.createButton(options)                // Create button
api.ui.createModal(options)                 // Create modal
api.ui.createNotification(options)          // Create notification
api.ui.createPanel(options)                 // Create panel
```

### Utils
```javascript
api.utils.throttle(fn, delay)               // Throttle function
api.utils.debounce(fn, delay)               // Debounce function
api.utils.sanitize(html)                    // Sanitize HTML
api.utils.logger                            // Logger instance
```

## Available Hooks

### DOM Lifecycle
- `dom:ready` - DOM is ready
- `dom:mutated` - DOM has changed
- `dom:element-added` - Element added
- `dom:navigate` - Page navigation (SPA)

### Plugin Lifecycle
- `plugin:before-enable` - Before plugin enables
- `plugin:enabled` - Plugin enabled
- `plugin:before-disable` - Before plugin disables
- `plugin:disabled` - Plugin disabled
- `plugin:error` - Plugin error

### Settings
- `settings:changed` - Any setting changed
- `settings:plugin-changed` - Plugin settings changed

### Filters (Chainable)
- `filter:threads` - Modify thread list
- `filter:posts` - Modify post list
- `filter:content` - Modify content

## Best Practices

1. **Clean up after yourself** - Remove all injected elements and styles in stop()
2. **Handle errors gracefully** - Use try-catch and log errors
3. **Use namespaced storage** - Prevents conflicts with other plugins
4. **Don't block the main thread** - Use async/await
5. **Respect user settings** - Always check if feature is enabled
6. **Document your plugin** - Include README and comments
7. **Version semantically** - Follow semver (major.minor.patch)

## Example: Simple Content Filter

```javascript
export default {
  id: 'content-filter',
  name: 'Content Filter',
  description: 'Filter content by keywords',
  version: '1.0.0',
  author: 'Your Name',
  
  settings: {
    keywords: {
      type: 'string',
      default: '',
      title: 'Filter Keywords',
      description: 'Comma-separated keywords'
    }
  },
  
  async start(api) {
    const keywords = api.settings.get('keywords')
      .split(',')
      .map(k => k.trim())
      .filter(k => k);
    
    api.hooks.register('filter:content', async (context) => {
      let { data } = context;
      
      keywords.forEach(keyword => {
        if (data.includes(keyword)) {
          data = data.replace(keyword, '[FILTERED]');
        }
      });
      
      return data;
    });
  },
  
  async stop(api) {
    // Hooks are automatically unregistered
  }
};
```

## Troubleshooting

**Plugin not loading?**
- Check that the `id` field is unique
- Ensure all required fields are present
- Check browser console for errors

**Settings not persisting?**
- Make sure you're using `api.settings.set()`
- Check that the setting key exists in schema

**Hooks not firing?**
- Verify the hook name is correct
- Check that the plugin is enabled
- Ensure the hook is registered in start()

## Resources

- [Framework Documentation](../../docs/plugin-development-guide.md)
- [API Reference](../../docs/api-reference.md)
- [Hooks Reference](../../docs/hooks-reference.md)
