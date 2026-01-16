# Plugin Development Guide

Complete guide for creating plugins for the BetterLooksmax framework.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Plugin Structure](#plugin-structure)
3. [Manifest Reference](#manifest-reference)
4. [Settings Schema](#settings-schema)
5. [Lifecycle Methods](#lifecycle-methods)
6. [Plugin API](#plugin-api)
7. [Hooks System](#hooks-system)
8. [Best Practices](#best-practices)
9. [Debugging](#debugging)
10. [Publishing](#publishing)

## Getting Started

### Prerequisites

- Basic JavaScript knowledge
- Understanding of browser extensions
- Familiarity with DOM manipulation

### Quick Start

1. Copy the plugin template from `plugins/plugin-template/`
2. Rename directory to your plugin name (lowercase, hyphen-separated)
3. Update the manifest in `index.js`
4. Register your plugin in `plugins/plugins.json`
5. Add plugin file to `manifest.json` web_accessible_resources
6. Implement your plugin logic
7. Test in the browser

### Plugin Registration

The framework uses a dynamic plugin discovery system. To register your plugin:

**1. Add to Plugin Registry** (`plugins/plugins.json`):

```json
{
  "plugins": [
    {
      "id": "my-plugin",
      "path": "plugins/my-plugin",
      "enabled": true
    }
  ]
}
```

**2. Add to Extension Manifest** (`manifest.json`):

```json
{
  "web_accessible_resources": [
    {
      "resources": [
        "plugins/my-plugin/index.js"
      ]
    }
  ]
}
```

The plugin registry is loaded at runtime and automatically discovers all enabled plugins. You can temporarily disable a plugin by setting `"enabled": false` without removing it from the registry.

### Minimal Plugin Example

```javascript
export default {
  id: 'my-plugin',
  name: 'My Plugin',
  description: 'A simple plugin',
  version: '1.0.0',
  
  async start(api) {
    api.utils.logger.info('Plugin started!');
  }
};
```

## Plugin Structure

### Required Files

```
my-plugin/
├── index.js          # Main plugin file (required)
└── README.md         # Documentation (recommended)
```

### Optional Files

```
my-plugin/
├── index.js
├── README.md
├── styles.css        # Custom styles
├── icon.svg          # Plugin icon
└── assets/           # Additional resources
```

## Manifest Reference

### Required Fields

```javascript
{
  id: 'unique-plugin-id',      // Alphanumeric, hyphens, underscores
  name: 'Display Name',        // User-facing name
  description: 'Description',  // Short description
  version: '1.0.0'             // Semantic version
}
```

### Optional Fields

```javascript
{
  author: 'Your Name',
  dependencies: ['other-plugin-id'],
  optionalDependencies: ['optional-plugin'],
  conflicts: ['incompatible-plugin'],
  tags: ['filter', 'enhancement'],
  category: 'filter',
  settings: { /* schema */ }
}
```

## Settings Schema

### Setting Definition

```javascript
settings: {
  settingKey: {
    type: 'boolean',     // Setting type
    default: true,       // Default value
    title: 'Title',      // Display title
    description: 'Desc', // Help text
    section: 'General'   // Section grouping
  }
}
```

### Supported Types

#### Boolean
```javascript
{
  type: 'boolean',
  default: true
}
```

#### String
```javascript
{
  type: 'string',
  default: '',
  placeholder: 'Enter text...',
  maxlength: 100
}
```

#### Number
```javascript
{
  type: 'number',
  default: 50,
  min: 0,
  max: 100,
  step: 5,
  slider: true  // Show as slider
}
```

#### Select/Enum
```javascript
{
  type: 'select',
  default: 'option1',
  enum: ['option1', 'option2', 'option3']
}
```

#### Color
```javascript
{
  type: 'color',
  default: '#4CAF50'
}
```

### Advanced Features

#### Custom Validation
```javascript
{
  type: 'number',
  validator: (value) => value >= 5 && value <= 50
}
```

#### Conditional Visibility
```javascript
{
  type: 'string',
  visible: (settings) => settings.advancedMode === true
}
```

## Lifecycle Methods

### init(api)

One-time initialization when plugin is first loaded.

```javascript
async init(api) {
  // Setup persistent data structures
  // Initialize resources
  api.utils.logger.info('Initializing...');
}
```

### start(api)

Called when plugin is enabled.

```javascript
async start(api) {
  // Get settings
  const enabled = api.settings.get('enabled');
  
  // Inject styles
  api.dom.style('...', 'my-plugin-styles');
  
  // Register hooks
  api.hooks.register('dom:ready', async (ctx) => {
    // Handle DOM ready
  });
  
  api.utils.logger.info('Started!');
}
```

### stop(api)

Called when plugin is disabled.

```javascript
async stop(api) {
  // Remove injected elements
  api.dom.removeStyle('my-plugin-styles');
  
  // Hooks are auto-unregistered
  
  api.utils.logger.info('Stopped');
}
```

### destroy(api)

Final cleanup when plugin is unloaded.

```javascript
async destroy(api) {
  // Clear stored data
  await api.storage.remove('cache');
  
  api.utils.logger.info('Destroyed');
}
```

## Plugin API

### Settings

```javascript
// Get setting value
const value = api.settings.get('key');

// Set setting value
await api.settings.set('key', newValue);

// Watch for changes
const unwatch = api.settings.watch('key', (newVal, oldVal) => {
  console.log(`Changed from ${oldVal} to ${newVal}`);
});

// Get all settings
const all = api.settings.getAll();
```

### Hooks

```javascript
// Register hook
const unregister = api.hooks.register('hook:name', async (context) => {
  // Handle hook
  return modifiedData;
}, {
  priority: 50,  // Lower runs first (0-100)
  once: false    // Run only once?
});

// Unregister hook
unregister();

// Emit custom hook
await api.hooks.emit('custom:hook', { data: 'value' });
```

### DOM Utilities

```javascript
// Wait for element
const element = await api.dom.waitFor('.selector', 5000);

// Observe elements
const unobserve = api.dom.observe('.selector', ({ type, element }) => {
  if (type === 'add') {
    // Element added
  }
});

// Inject element
const button = api.dom.createElement('<button>Click</button>');
api.dom.inject(button, 'append', document.body);

// Remove element
api.dom.remove(button);

// Inject styles
api.dom.style('...', 'style-id');
api.dom.removeStyle('style-id');
```

### Storage

```javascript
// Store data (namespaced to plugin)
await api.storage.set('key', { data: 'value' });

// Get data
const data = await api.storage.get('key');

// Remove data
await api.storage.remove('key');
```

### UI Components

```javascript
// Create button
const button = api.ui.createButton({
  text: 'Click Me',
  onClick: () => alert('Clicked!')
});

// Create notification
api.ui.createNotification({
  message: 'Hello!',
  type: 'info',     // 'info', 'success', 'warning', 'error'
  duration: 3000
});

// Create modal
const modal = api.ui.createModal({
  title: 'Modal Title',
  content: '<p>Content</p>',
  buttons: [
    {
      text: 'OK',
      onClick: () => modal.close()
    }
  ]
});
modal.show();

// Create panel
const panel = api.ui.createPanel({
  title: 'Panel',
  content: '<p>Content</p>',
  collapsible: true
});
document.body.appendChild(panel);
```

### Utils

```javascript
// Throttle function
const throttled = api.utils.throttle(() => {
  console.log('Throttled!');
}, 1000);

// Debounce function
const debounced = api.utils.debounce(() => {
  console.log('Debounced!');
}, 500);

// Sanitize HTML
const safe = api.utils.sanitize('<script>alert("xss")</script>');

// Logger
api.utils.logger.info('Info message');
api.utils.logger.warn('Warning message');
api.utils.logger.error('Error message');
```

## Hooks System

### Available Hooks

#### DOM Lifecycle
- `dom:ready` - DOM is ready
- `dom:mutated` - DOM has changed
- `dom:navigate` - Page navigation (SPA)

#### Plugin Lifecycle
- `plugin:before-enable` - Before plugin enables
- `plugin:enabled` - Plugin enabled
- `plugin:before-disable` - Before plugin disables
- `plugin:disabled` - Plugin disabled
- `plugin:error` - Plugin error occurred

#### Settings
- `settings:changed` - Any setting changed
- `settings:plugin-changed` - Plugin settings changed

### Hook Context

```javascript
api.hooks.register('hook:name', async (context) => {
  // Access data
  const { data } = context;
  
  // Cancel propagation (if cancelable)
  context.cancel();
  
  // Return modified data (for filter hooks)
  return modifiedData;
});
```

## Best Practices

### 1. Clean Up Resources

Always remove injected elements and styles in `stop()`:

```javascript
async stop(api) {
  api.dom.removeStyle('my-styles');
  const element = document.querySelector('.my-element');
  if (element) api.dom.remove(element);
}
```

### 2. Handle Errors Gracefully

```javascript
async start(api) {
  try {
    const element = await api.dom.waitFor('.target', 5000);
    // Use element
  } catch (error) {
    api.utils.logger.error('Target not found:', error);
    // Handle gracefully
  }
}
```

### 3. Use Namespaced Storage

```javascript
// Good - namespaced to plugin
await api.storage.set('cache', data);

// Bad - global storage
await storageAdapter.set('cache', data);
```

### 4. Respect User Settings

```javascript
async start(api) {
  if (!api.settings.get('enabled')) {
    return; // Don't do anything if disabled
  }
  
  // Proceed with plugin logic
}
```

### 5. Optimize Performance

```javascript
// Use throttle/debounce for frequent operations
const throttled = api.utils.throttle(() => {
  // Expensive operation
}, 1000);

api.hooks.register('dom:mutated', throttled);
```

## Debugging

### Debug Panel

Press `Ctrl+Shift+D` to open debug panel.

Features:
- Plugin inspector
- Hook tracer
- Live logs
- Statistics

### Console Logging

```javascript
api.utils.logger.debug('Debug info');
api.utils.logger.info('Info message');
api.utils.logger.warn('Warning');
api.utils.logger.error('Error');
```

### Framework Access

In development, access framework via:

```javascript
window.__BetterLooksmaxFramework
```

## Publishing

### Checklist

- [ ] All metadata fields filled
- [ ] README.md included
- [ ] Settings have descriptions
- [ ] Error handling implemented
- [ ] Resources cleaned up in stop()
- [ ] Tested enable/disable
- [ ] No console errors
- [ ] Performance optimized

### Version Guidelines

Follow semantic versioning:
- `1.0.0` - Initial release
- `1.0.1` - Bug fixes
- `1.1.0` - New features
- `2.0.0` - Breaking changes

## Support

- [API Reference](api-reference.md)
- [Hooks Reference](hooks-reference.md)
- [Architecture Guide](architecture.md)
- [Plugin Template](../plugins/plugin-template/)
