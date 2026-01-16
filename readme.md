# BetterLooksmax Plugin Framework

A modern, extensible browser extension framework inspired by Vencord, where all features are plugins that can be enabled/disabled dynamically with auto-generated settings UI.

## ✨ Features

- **🔌 Plugin Architecture** - Everything is a plugin, easy to extend
- **⚙️ Auto-Generated UI** - Settings panels generated from schemas
- **🔄 Hot-Swappable** - Enable/disable plugins without reload
- **🎨 Modern UI** - Clean, minimal interface
- **📱 Mobile-Friendly** - Responsive design
- **🐛 Debug Tools** - Built-in debugging panel
- **🌐 Cross-Browser** - Works on Chrome and Firefox
- **📦 Zero Dependencies** - Pure vanilla JavaScript

## 🚀 Quick Start

### For Users

1. Clone or download this repository
2. Open your browser's extensions page
   - Chrome: `chrome://extensions/`
   - Firefox: `about:addons`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder
5. Click the extension icon to open settings

### For Developers

```bash
# Clone the repository
git clone https://github.com/yourusername/betterlooksmax.git
cd betterlooksmax

# No build step required!
# Just load the extension in your browser
```

## 📖 Documentation

- [Quick Start Guide](docs/quick-start.md)
- [Plugin Development Guide](docs/plugin-development-guide.md)
- [API Reference](docs/api-reference.md)
- [Architecture Overview](readme.md) (Original blueprint)

## 🎯 Creating a Plugin

### 1. Copy the Template

```bash
cp -r plugins/plugin-template plugins/my-plugin
```

### 2. Define Your Plugin

```javascript
// plugins/my-plugin/index.js
export default {
  id: 'my-plugin',
  name: 'My Plugin',
  description: 'Does something awesome',
  version: '1.0.0',
  
  settings: {
    enabled: {
      type: 'boolean',
      default: false,
      title: 'Enable Feature',
      description: 'Turn this on/off'
    }
  },
  
  async start(api) {
    // Your plugin logic here
    api.utils.logger.info('Plugin started!');
  },
  
  async stop(api) {
    // Cleanup here
  }
};
```

### 3. Register Your Plugin

**Add to `plugins/plugins.json`:**

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

**Add to `manifest.json` web_accessible_resources:**

```json
"resources": [
  "plugins/my-plugin/index.js"
]
```

### 4. Test It

1. Reload the extension
2. Open settings dashboard
3. Find your plugin and enable it
4. Configure settings as needed

## 🔌 Example Plugins

### Content Filter

```javascript
export default {
  id: 'content-filter',
  name: 'Content Filter',
  description: 'Filter unwanted content',
  version: '1.0.0',
  
  settings: {
    keywords: {
      type: 'string',
      default: '',
      title: 'Keywords to Filter',
      placeholder: 'word1, word2'
    }
  },
  
  async start(api) {
    const keywords = api.settings.get('keywords')
      .split(',')
      .map(k => k.trim());
    
    api.hooks.register('filter:content', async (context) => {
      let { data } = context;
      keywords.forEach(keyword => {
        data = data.replace(keyword, '[filtered]');
      });
      return data;
    });
  }
};
```

### UI Enhancer

```javascript
export default {
  id: 'ui-enhancer',
  name: 'UI Enhancer',
  description: 'Enhance the UI',
  version: '1.0.0',
  
  settings: {
    highlightColor: {
      type: 'color',
      default: '#4CAF50',
      title: 'Highlight Color'
    }
  },
  
  async start(api) {
    const color = api.settings.get('highlightColor');
    
    api.dom.style(`
      .highlight {
        background-color: ${color};
      }
    `, 'ui-enhancer-styles');
  },
  
  async stop(api) {
    api.dom.removeStyle('ui-enhancer-styles');
  }
};
```

## 🛠️ Core Features

### Plugin Loader
- Dynamic plugin discovery
- Dependency resolution
- Topological sorting for load order

### Settings Store
- Schema validation
- Type enforcement
- Change watchers
- Import/export

### Hook System
- Priority-based execution
- Async handlers
- Filter hooks (chainable)
- Auto-cleanup

### UI Generator
- Auto-generate settings from schemas
- Support for all input types
- Live validation
- Conditional visibility

### IPC Manager
- Cross-context messaging
- Request/response pattern
- Event broadcasting
- Timeout management

## 🎨 Plugin API

### Settings
```javascript
api.settings.get(key)
api.settings.set(key, value)
api.settings.watch(key, callback)
```

### Hooks
```javascript
api.hooks.register(name, handler, options)
api.hooks.unregister(name, handler)
api.hooks.emit(name, data)
```

### DOM
```javascript
api.dom.waitFor(selector, timeout)
api.dom.observe(selector, callback)
api.dom.inject(element, position, ref)
api.dom.style(css, id)
```

### Storage
```javascript
api.storage.get(key)
api.storage.set(key, value)
api.storage.remove(key)
```

### UI Components
```javascript
api.ui.createButton(options)
api.ui.createModal(options)
api.ui.createNotification(options)
api.ui.createPanel(options)
```

## 🐛 Debugging

Press `Ctrl+Shift+D` to open the debug panel.

Features:
- Plugin inspector
- Hook tracer
- Live logs
- Performance stats

## 📁 Project Structure

```
BetterLooksmax/
├── src/
│   ├── core/              # Framework core
│   │   ├── PluginLoader.js
│   │   ├── PluginRegistry.js
│   │   ├── LifecycleManager.js
│   │   ├── HookSystem.js
│   │   ├── SettingsStore.js
│   │   ├── UIGenerator.js
│   │   ├── IPCManager.js
│   │   └── StorageAdapter.js
│   ├── api/               # Plugin API
│   │   └── PluginAPI.js
│   ├── content.js         # Content script
│   ├── background.js      # Background worker
│   └── popup/             # Settings UI
│       ├── popup.html
│       ├── popup.js
│       └── popup.css
├── plugins/               # Plugins directory
│   ├── plugin-template/
│   ├── example-filter/
│   └── example-enhancer/
├── utils/                 # Utilities
│   ├── dom.js
│   ├── logger.js
│   └── validators.js
├── docs/                  # Documentation
└── manifest.json          # Extension manifest
```

## 🤝 Contributing

Contributions are welcome! Please read the [contribution guide](docs/howtocontribute.md).

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Creating Plugins

1. Use the plugin template
2. Follow the plugin development guide
3. Include README and examples
4. Test on both Chrome and Firefox
5. Submit via pull request

## 📋 Requirements

- Chrome 88+ or Firefox 109+
- No external dependencies
- Pure vanilla JavaScript (ES6 modules)

## 🎯 Roadmap

- [x] Core framework implementation
- [x] Plugin loader with dependency resolution
- [x] Auto-generated settings UI
- [x] Cross-browser compatibility
- [x] Debug panel
- [ ] Hot-reload in development
- [ ] Plugin marketplace
- [ ] Remote plugin loading
- [ ] Theme system
- [ ] i18n support

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Inspired by [Vencord](https://github.com/Vendicated/Vencord)
- Built with vanilla JavaScript
- No dependencies, just pure code

## 📞 Support

- Documentation: [docs/](docs/)
- Issues: GitHub Issues
- Discussions: GitHub Discussions

---

**Made with ❤️ by the BetterLooksmax Team**
