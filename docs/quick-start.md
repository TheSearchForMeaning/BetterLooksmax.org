# Quick Start Guide

Get started with BetterLooksmax plugin framework in minutes.

## Installation

### For Users

1. Download the extension files
2. Open Chrome/Firefox extensions page
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the BetterLooksmax folder

### For Developers

```bash
git clone https://github.com/yourusername/betterlooksmax.git
cd betterlooksmax
# No build step required - pure JavaScript
```

## Using the Extension

### Opening Settings

Click the extension icon in your browser toolbar to open the settings dashboard.

### Enabling Plugins

1. Browse available plugins in the dashboard
2. Toggle the switch to enable/disable plugins
3. Click "Settings" to configure plugin options
4. Changes apply immediately

### Keyboard Shortcuts

- `Ctrl+Shift+D` - Open debug panel (in debug mode)

## Creating Your First Plugin

### 1. Copy the Template

```bash
cp -r plugins/plugin-template plugins/my-plugin
```

### 2. Edit the Manifest

```javascript
// plugins/my-plugin/index.js
export default {
  id: 'my-plugin',
  name: 'My First Plugin',
  description: 'Does something cool',
  version: '1.0.0',
  
  async start(api) {
    api.ui.createNotification({
      message: 'My plugin is running!',
      type: 'success'
    });
  }
};
```

### 3. Register Your Plugin

Add your plugin to `plugins/plugins.json`:

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

Then add it to `manifest.json` web_accessible_resources:

```json
"web_accessible_resources": [
  {
    "resources": [
      "plugins/my-plugin/index.js"
    ]
  }
]
```

### 4. Test It

1. Reload the extension
2. Open settings
3. Enable "My First Plugin"
4. You should see the notification!

## Next Steps

- Read the [Plugin Development Guide](plugin-development-guide.md)
- Explore [example plugins](../plugins/)
- Check the [API Reference](api-reference.md)
- Join the community

## Common Issues

### Plugin Not Showing Up

- Check that `id` is unique
- Ensure `index.js` exports default manifest
- Verify all required fields are present
- Check browser console for errors

### Settings Not Saving

- Make sure you're using `api.settings.set()`
- Check that setting key exists in schema
- Verify storage permissions in manifest

### Styles Not Applying

- Ensure styles are injected in `start()`
- Remember to remove styles in `stop()`
- Check for CSS specificity issues

## Getting Help

- Check the documentation
- Open an issue on GitHub
- Ask in the community forum

## Examples

### Simple Button Plugin

```javascript
export default {
  id: 'hello-button',
  name: 'Hello Button',
  description: 'Adds a hello button',
  version: '1.0.0',
  
  async start(api) {
    const button = api.ui.createButton({
      text: 'Say Hello',
      onClick: () => {
        api.ui.createNotification({
          message: 'Hello from plugin!',
          type: 'info'
        });
      }
    });
    
    document.body.appendChild(button);
  },
  
  async stop(api) {
    const button = document.querySelector('.plugin-button');
    if (button) api.dom.remove(button);
  }
};
```

### Content Filter Plugin

```javascript
export default {
  id: 'word-filter',
  name: 'Word Filter',
  description: 'Filter specific words',
  version: '1.0.0',
  
  settings: {
    words: {
      type: 'string',
      default: '',
      title: 'Words to Filter',
      description: 'Comma-separated'
    }
  },
  
  async start(api) {
    const words = api.settings.get('words')
      .split(',')
      .map(w => w.trim())
      .filter(w => w);
    
    api.hooks.register('filter:content', async (context) => {
      let { data } = context;
      
      words.forEach(word => {
        data = data.replace(new RegExp(word, 'gi'), '[filtered]');
      });
      
      return data;
    });
  }
};
```

## Tips

1. **Start Small** - Begin with simple plugins
2. **Use the Template** - Don't start from scratch
3. **Test Frequently** - Enable/disable to test changes
4. **Check Console** - Look for errors and warnings
5. **Clean Up** - Always remove what you inject

## Resources

- [Plugin Template](../plugins/plugin-template/)
- [Example Plugins](../plugins/)
- [API Documentation](api-reference.md)
- [Architecture Overview](architecture.md)

Happy plugin development! 🚀
