# Plugin Directory

This directory contains all BetterLooksmax plugins. Plugins are automatically discovered from the `plugins.json` registry.

## 📁 Directory Structure

```
plugins/
├── plugins.json          # Plugin registry (auto-discovery)
├── plugin-template/      # Template for creating new plugins
├── public-mode/          # Privacy plugin
├── greycel-filter/       # User filter plugin
└── text-presets/         # Text formatting plugin
```

## ✨ Adding a New Plugin

### 1. Create Plugin Directory

Create a new directory with your plugin's ID (kebab-case):

```bash
plugins/your-plugin-name/
```

### 2. Create Plugin File

Create an `index.js` file in your plugin directory following the plugin template structure:

```javascript
export default {
  id: 'your-plugin-name',
  name: 'Your Plugin Name',
  description: 'What your plugin does',
  version: '1.0.0',
  author: 'Your Name',
  
  settings: {
    // Your settings schema
  },
  
  async init(api) {
    // Initialize your plugin
  },
  
  async start(api) {
    // Start your plugin
  },
  
  async stop(api) {
    // Stop your plugin
  }
};
```

### 3. Register in `plugins.json`

Add your plugin to the registry:

```json
{
  "plugins": [
    {
      "id": "your-plugin-name",
      "path": "plugins/your-plugin-name",
      "enabled": true
    }
  ]
}
```

### 4. Add to Manifest

Add your plugin file to `manifest.json` under `web_accessible_resources`:

```json
"web_accessible_resources": [
  {
    "resources": [
      "plugins/your-plugin-name/index.js"
    ]
  }
]
```

### 5. Reload Extension

Reload the browser extension to pick up your new plugin.

## 🔧 Plugin Registry (`plugins.json`)

The plugin registry is the source of truth for plugin discovery:

```json
{
  "plugins": [
    {
      "id": "plugin-id",        // Unique identifier
      "path": "plugins/path",   // Path to plugin directory
      "enabled": true           // Whether to load this plugin
    }
  ]
}
```

**Properties:**
- `id` (string): Unique plugin identifier (must match plugin's `id` field)
- `path` (string): Relative path to plugin directory
- `enabled` (boolean): Set to `false` to temporarily disable a plugin without removing it

## 📚 Documentation

For detailed plugin development guide, see:
- `/docs/plugin-development-guide.md` - Complete plugin API reference
- `/docs/quick-start.md` - Quick start guide
- `/plugins/plugin-template/` - Ready-to-use template

## 🎯 Best Practices

1. **One plugin per directory** - Keep each plugin self-contained
2. **Use the plugin template** - Start from `/plugins/plugin-template/`
3. **Follow naming conventions** - Use kebab-case for IDs and directories
4. **Clean up resources** - Always implement `stop()` to remove event listeners and DOM elements
5. **Use the API** - Leverage the framework's API instead of direct DOM manipulation
6. **Test thoroughly** - Test enable, disable, and navigation scenarios

## 🔐 Security

All plugin files must be declared in `manifest.json` `web_accessible_resources` due to browser extension security policies. This is intentional and prevents unauthorized code execution.
