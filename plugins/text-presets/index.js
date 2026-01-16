// Text Format Presets Plugin for BetterLooksmax
export default {
    id: 'text-format-presets',
    name: 'Text Format Presets',
    description: 'Create and apply custom text formatting presets with multi-point gradients and keyboard shortcuts',
    version: '2.0.0',
    author: 'BetterLooksmax',
    category: 'editor',
    
    settings: {
      enabled: {
        type: 'boolean',
        default: true,
        title: 'Enable Text Presets',
        description: 'Show presets button in editor toolbar'
      },
      autoStyle: {
        type: 'boolean',
        default: false,
        title: 'Auto-Apply Default Style',
        description: 'Automatically apply default preset to posts',
        section: 'Auto-Styling'
      },
      defaultPresetId: {
        type: 'string',
        default: '',
        title: 'Default Preset ID',
        description: 'Preset to auto-apply (leave empty to disable)',
        section: 'Auto-Styling'
      }
    },
  
    state: {
      presets: {},
      button: null,
      modal: null,
      editingGradient: null // Track which gradient is being edited
    },
  
    async init(api) {
      this.state.presets = await api.storage.get('presets') || {};
    },
  
    async start(api) {
      if (!api.settings.get('enabled')) return;
  
      try {
        await api.dom.waitFor('.fr-element', 10000);
        this.addButton(api);
        this.addKeyboardShortcuts(api);
      } catch (e) {
        api.utils.logger.error('Editor not found');
      }
    },
  
    async stop(api) {
      if (this.state.button) api.dom.remove(this.state.button);
      if (this.state.modal) api.dom.remove(this.state.modal);
    },
  
    // Add toolbar button
    addButton(api) {
      const italic = document.querySelector('#italic-1');
      if (!italic) return;
  
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fr-command fr-btn';
      btn.title = 'Format Presets';
      btn.innerHTML = '<i class="fas fa-brush"></i>';
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showModal(api);
        return false;
      };
  
      italic.after(btn);
      this.state.button = btn;
    },
  
    // Show modal
    showModal(api) {
      if (this.state.modal) return;
  
      const overlay = this.el('div', { 
        style: 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:100001'
      });
  
      const modal = this.el('div', {
        style: 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#181824;color:#eee;padding:24px;border-radius:12px;z-index:100002;width:520px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 4px 24px rgba(0,0,0,0.55)'
      }, [
        this.el('h3', { style: 'margin:0 0 20px' }, ['Text Format Presets']),
        this.el('div', { id: 'presetsList', style: 'margin-bottom:20px;max-height:300px;overflow-y:auto' }),
        this.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px' }, [
          this.el('button', { class: 'button button--primary', type: 'button' }, ['New Preset']),
          this.el('button', { class: 'button', type: 'button' }, ['Import']),
          this.el('button', { class: 'button', type: 'button' }, ['Export']),
        ]),
        this.el('button', { class: 'button', type: 'button', style: 'width:100%' }, ['Close'])
      ]);
  
      modal.children[2].children[0].onclick = () => this.showForm(modal, api);
      modal.children[2].children[1].onclick = () => this.importPresets(api);
      modal.children[2].children[2].onclick = () => this.exportPresets(api);
      modal.children[3].onclick = () => {
        api.dom.remove(container);
        this.state.modal = null;
      };
  
      const container = this.el('div', {}, [overlay, modal]);
      overlay.onclick = modal.children[3].onclick;
  
      document.body.appendChild(container);
      this.state.modal = container;
      this.loadPresets(modal.querySelector('#presetsList'), api);
    },
  
    // Show create/edit form
    showForm(modal, api, editId = null, preset = null) {
      // Initialize gradient points for editing
      const textPoints = preset?.styles.textGradient?.colors || ['#FF0000', '#0000FF'];
      const bgPoints = preset?.styles.bgGradient?.colors || ['#FF0000', '#0000FF'];
  
      const form = this.el('div', { style: 'border-top:1px solid #333;padding-top:15px;margin-top:15px' }, [
        this.input('Preset Name', 'name', preset?.name),
        this.checkbox('Bold', 'bold', preset?.styles.bold),
        this.checkbox('Italic', 'italic', preset?.styles.italic),
        this.select('Font Size', 'size', ['', '12px', '14px', '16px', '18px', '20px', '24px', '30px'], preset?.styles.fontSize),
        this.gradientEditor('Text Gradient', 'text', textPoints),
        this.gradientEditor('Background Gradient', 'bg', bgPoints),
        this.colorInput('Text Color', 'color', preset?.styles.color),
        this.input('Shortcut', 'shortcut', preset?.shortcut, 'e.g. CmdOrCtrl+Shift+G'),
        this.el('div', { style: 'margin-top:15px' }, [
          this.el('button', { class: 'button button--primary', style: 'margin-right:10px', type: 'button' }, ['Save']),
          this.el('button', { class: 'button', type: 'button' }, ['Cancel'])
        ])
      ]);
  
      form.children[8].children[0].onclick = () => this.savePreset(form, modal, api, editId);
      form.children[8].children[1].onclick = () => {
        api.dom.remove(form);
        modal.children[2].style.display = 'flex';
      };
  
      modal.children[2].style.display = 'none';
      modal.insertBefore(form, modal.children[2]);
    },
  
    // Export presets to JSON
    exportPresets(api) {
      try {
        const data = JSON.stringify(this.state.presets, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `text-presets-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        api.ui.createNotification({ 
          message: 'Presets exported successfully', 
          type: 'success',
          duration: 2000 
        });
      } catch (e) {
        api.utils.logger.error('Export error:', e);
        api.ui.createNotification({ 
          message: 'Failed to export presets', 
          type: 'error' 
        });
      }
    },
  
    // Import presets from JSON
    importPresets(api) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      
      input.onchange = async (e) => {
        try {
          const file = e.target.files[0];
          if (!file) return;
          
          const text = await file.text();
          const imported = JSON.parse(text);
          
          // Validate structure
          if (typeof imported !== 'object' || imported === null) {
            throw new Error('Invalid preset format');
          }
          
          // Count how many presets will be imported
          const count = Object.keys(imported).length;
          
          if (!confirm(`Import ${count} preset(s)? This will merge with existing presets.`)) {
            return;
          }
          
          // Merge imported presets
          this.state.presets = { ...this.state.presets, ...imported };
          await api.storage.set('presets', this.state.presets);
          
          // Reload list
          const modal = this.state.modal.querySelector('div[style*="position:fixed"]');
          this.loadPresets(modal.querySelector('#presetsList'), api);
          
          api.ui.createNotification({ 
            message: `${count} preset(s) imported successfully`, 
            type: 'success',
            duration: 3000
          });
        } catch (e) {
          api.utils.logger.error('Import error:', e);
          api.ui.createNotification({ 
            message: 'Failed to import presets. Invalid file format.', 
            type: 'error',
            duration: 4000
          });
        }
      };
      
      input.click();
    },
  
    // Gradient editor with multi-point support
    gradientEditor(label, type, initialColors) {
      const container = this.el('div', { style: 'margin-bottom:15px' });
      
      const labelEl = this.el('label', { style: 'display:block;margin-bottom:8px;color:#eee;font-size:13px' }, [label]);
      
      const enableCheckbox = this.el('input', { type: 'checkbox', id: `use${type}Gradient` });
      if (initialColors && initialColors.length > 0) enableCheckbox.checked = true;
      
      const enableLabel = this.el('label', { 
        style: 'display:flex;align-items:center;gap:6px;margin-bottom:10px;color:#eee;cursor:pointer' 
      }, [enableCheckbox, `Enable ${label}`]);
      
      const editorDiv = this.el('div', { 
        id: `${type}GradientEditor`,
        style: initialColors && initialColors.length > 0 ? 'display:block' : 'display:none'
      });
      
      const pointsContainer = this.el('div', { id: `${type}Points`, style: 'margin-bottom:10px' });
      
      const addBtn = this.el('button', { 
        class: 'button button--primary', 
        type: 'button',
        style: 'width:100%;margin-bottom:10px;font-size:12px;padding:6px'
      }, ['+ Add Color Point']);
      
      const preview = this.el('div', { 
        id: `${type}Preview`,
        style: 'height:30px;border-radius:4px;border:1px solid #333;margin-bottom:10px'
      });
      
      editorDiv.appendChild(pointsContainer);
      editorDiv.appendChild(addBtn);
      editorDiv.appendChild(preview);
      
      // Build initial points
      this.buildGradientPoints(type, initialColors, pointsContainer, preview);
      
      // Enable/disable toggle
      enableCheckbox.onchange = () => {
        editorDiv.style.display = enableCheckbox.checked ? 'block' : 'none';
        if (enableCheckbox.checked && pointsContainer.children.length === 0) {
          this.buildGradientPoints(type, ['#FF0000', '#0000FF'], pointsContainer, preview);
        }
      };
      
      // Add point button
      addBtn.onclick = (e) => {
        e.preventDefault();
        const points = this.getGradientColors(pointsContainer);
        points.push('#00FF00');
        this.buildGradientPoints(type, points, pointsContainer, preview);
      };
      
      container.appendChild(labelEl);
      container.appendChild(enableLabel);
      container.appendChild(editorDiv);
      
      return container;
    },
  
    // Build gradient color points
    buildGradientPoints(type, colors, container, preview) {
      container.innerHTML = '';
      
      colors.forEach((color, i) => {
        const pointDiv = this.el('div', { 
          style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px' 
        });
        
        const label = this.el('label', { 
          style: 'font-size:11px;color:#ccc;min-width:50px' 
        }, [i === 0 ? 'Start' : i === colors.length - 1 ? 'End' : `Point ${i}`]);
        
        const colorInput = this.el('input', { 
          type: 'color', 
          value: color,
          style: 'width:50px;height:30px;border:1px solid #333;border-radius:3px;cursor:pointer;background:#1a1a1a'
        });
        
        colorInput.oninput = () => this.updateGradientPreview(type, container, preview);
        
        pointDiv.appendChild(label);
        pointDiv.appendChild(colorInput);
        
        // Remove button for middle points
        if (i > 0 && i < colors.length - 1) {
          const removeBtn = this.el('button', { 
            type: 'button',
            class: 'button button--cta',
            style: 'width:24px;height:24px;padding:0;font-size:14px;line-height:1'
          }, ['×']);
          
          removeBtn.onclick = (e) => {
            e.preventDefault();
            const currentColors = this.getGradientColors(container);
            currentColors.splice(i, 1);
            this.buildGradientPoints(type, currentColors, container, preview);
          };
          
          pointDiv.appendChild(removeBtn);
        }
        
        container.appendChild(pointDiv);
      });
      
      this.updateGradientPreview(type, container, preview);
    },
  
    // Get gradient colors from point inputs
    getGradientColors(container) {
      return Array.from(container.querySelectorAll('input[type="color"]')).map(input => input.value);
    },
  
    // Update gradient preview
    updateGradientPreview(type, container, preview) {
      const colors = this.getGradientColors(container);
      preview.style.background = `linear-gradient(to right, ${colors.join(', ')})`;
    },
  
    // Save preset
    async savePreset(form, modal, api, editId) {
      const name = form.querySelector('#name').value.trim();
      if (!name) return api.ui.createNotification({ message: 'Enter a name', type: 'warning' });
  
      // Get gradient data
      const textGradient = form.querySelector('#usetextGradient').checked ? {
        colors: this.getGradientColors(form.querySelector('#textPoints'))
      } : null;
      
      const bgGradient = form.querySelector('#usebgGradient').checked ? {
        colors: this.getGradientColors(form.querySelector('#bgPoints'))
      } : null;
  
      const preset = {
        name,
        shortcut: form.querySelector('#shortcut').value.trim() || null,
        styles: {
          bold: form.querySelector('#bold').checked,
          italic: form.querySelector('#italic').checked,
          fontSize: form.querySelector('#size').value || null,
          textGradient,
          bgGradient,
          color: form.querySelector('#useColor').checked ? form.querySelector('#color').value : null
        }
      };
  
      const id = editId || `preset_${Date.now()}`;
      this.state.presets[id] = preset;
      await api.storage.set('presets', this.state.presets);
  
      api.ui.createNotification({ message: 'Preset saved', type: 'success' });
      api.dom.remove(form);
      modal.children[2].style.display = 'flex';
      this.loadPresets(modal.querySelector('#presetsList'), api);
    },
  
    // Load presets list
    loadPresets(container, api) {
      container.innerHTML = '';
      
      if (Object.keys(this.state.presets).length === 0) {
        container.appendChild(this.el('p', { style: 'color:#888;text-align:center;padding:20px' }, ['No presets yet. Create one to get started!']));
        return;
      }
  
      Object.entries(this.state.presets).forEach(([id, preset]) => {
        const card = this.el('div', {
          style: 'display:flex;justify-content:space-between;align-items:center;padding:12px;background:#222;border-radius:6px;margin-bottom:10px'
        }, [
          this.el('div', {}, [
            this.el('span', { style: 'font-weight:500' }, [preset.name]),
            preset.shortcut ? this.el('span', { style: 'color:#888;font-size:11px;margin-left:8px' }, [`[${preset.shortcut}]`]) : null
          ].filter(Boolean)),
          this.el('div', { style: 'display:flex;gap:6px' }, [
            this.el('button', { class: 'button button--primary', style: 'font-size:12px', type: 'button' }, ['Apply']),
            this.el('button', { class: 'button', style: 'font-size:12px', type: 'button' }, ['Edit']),
            this.el('button', { class: 'button button--cta', style: 'font-size:12px', type: 'button' }, ['Delete'])
          ])
        ]);
  
        card.children[1].children[0].onclick = () => {
          this.applyPreset(preset, api);
          api.dom.remove(this.state.modal);
          this.state.modal = null;
        };
        card.children[1].children[1].onclick = () => this.showForm(container.closest('div[style*="position:fixed"]'), api, id, preset);
        card.children[1].children[2].onclick = async () => {
          if (!confirm(`Delete "${preset.name}"?`)) return;
          delete this.state.presets[id];
          await api.storage.set('presets', this.state.presets);
          this.loadPresets(container, api);
        };
  
        container.appendChild(card);
      });
    },
  
    // Apply preset
    async applyPreset(preset, api) {
      try {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
  
        const range = sel.getRangeAt(0);
        const text = range.toString();
        if (!text) return;
  
        let formatted = text;
  
        // Apply text gradient
        if (preset.styles.textGradient && !preset.styles.color) {
          formatted = this.applyMultiPointGradient(formatted, preset.styles.textGradient.colors, false);
        }
  
        // Apply background gradient
        if (preset.styles.bgGradient) {
          const bg = this.applyMultiPointGradient(text, preset.styles.bgGradient.colors, true);
          formatted = preset.styles.textGradient && !preset.styles.color ? this.mergeGradients(formatted, bg) : bg;
        }
  
        // Apply solid color
        if (preset.styles.color) {
          formatted = `[COLOR=${preset.styles.color}]${formatted}[/COLOR]`;
        }
  
        // Apply formatting
        if (preset.styles.fontSize) formatted = `[SIZE=${preset.styles.fontSize}]${formatted}[/SIZE]`;
        if (preset.styles.italic) formatted = `[I]${formatted}[/I]`;
        if (preset.styles.bold) formatted = `[B]${formatted}[/B]`;
  
        // Convert BB code to HTML
        const html = this.bbCodeToHtml(formatted);
        
        // Insert HTML
        range.deleteContents();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        range.insertNode(fragment);
        range.collapse(false);
  
        api.ui.createNotification({ message: `Applied "${preset.name}"`, type: 'success', duration: 2000 });
      } catch (e) {
        api.utils.logger.error('Apply error:', e);
        api.ui.createNotification({ message: 'Failed to apply preset', type: 'error' });
      }
    },
  
    // Apply multi-point gradient
    applyMultiPointGradient(text, colors, isBg = false) {
      if (!colors || colors.length < 2) return text;
  
      const tag = isBg ? 'BGCOLOR' : 'COLOR';
      const rgbColors = colors.map(this.hexToRgb);
  
      return text.split('').map((char, i) => {
        const position = i / Math.max(1, text.length - 1);
        const segmentSize = 1 / (rgbColors.length - 1);
        const segmentIndex = Math.min(Math.floor(position / segmentSize), rgbColors.length - 2);
        const segmentPosition = (position - segmentIndex * segmentSize) / segmentSize;
  
        const start = rgbColors[segmentIndex];
        const end = rgbColors[segmentIndex + 1];
  
        const r = Math.round(start.r + (end.r - start.r) * segmentPosition);
        const g = Math.round(start.g + (end.g - start.g) * segmentPosition);
        const b = Math.round(start.b + (end.b - start.b) * segmentPosition);
  
        return `[${tag}=rgb(${r}, ${g}, ${b})]${char}[/${tag}]`;
      }).join('');
    },
  
    // Merge text and background gradients
    mergeGradients(textGrad, bgGrad) {
      const txt = textGrad.match(/\[COLOR=[^\]]+\][^\[]+\[\/COLOR\]/g) || [];
      const bg = bgGrad.match(/\[BGCOLOR=[^\]]+\][^\[]+\[\/BGCOLOR\]/g) || [];
      
      return txt.map((t, i) => {
        const char = t.match(/\[COLOR=[^\]]+\]([^\[]+)\[\/COLOR\]/)?.[1] || '';
        const tColor = t.match(/\[COLOR=([^\]]+)\]/)?.[1];
        const bColor = bg[i]?.match(/\[BGCOLOR=([^\]]+)\]/)?.[1];
        
        let result = char;
        if (tColor) result = `[COLOR=${tColor}]${result}[/COLOR]`;
        if (bColor) result = `[BGCOLOR=${bColor}]${result}[/BGCOLOR]`;
        return result;
      }).join('');
    },
  
    // Convert BB code to HTML client-side
    bbCodeToHtml(bbCode) {
      let html = bbCode;
      
      // Convert tags using non-greedy matching and handle nested content
      // Process innermost tags first to handle nesting properly
      
      // COLOR tags - match everything until the closing tag
      html = html.replace(/\[COLOR=([^\]]+)\]((?:(?!\[COLOR=).)*?)\[\/COLOR\]/gs, '<span style="color:$1">$2</span>');
      
      // BGCOLOR tags
      html = html.replace(/\[BGCOLOR=([^\]]+)\]((?:(?!\[BGCOLOR=).)*?)\[\/BGCOLOR\]/gs, '<span style="background-color:$1">$2</span>');
      
      // SIZE tags
      html = html.replace(/\[SIZE=([^\]]+)\]((?:(?!\[SIZE=).)*?)\[\/SIZE\]/gs, '<span style="font-size:$1">$2</span>');
      
      // FONT tags
      html = html.replace(/\[FONT=([^\]]+)\]((?:(?!\[FONT=).)*?)\[\/FONT\]/gs, '<span style="font-family:$1">$2</span>');
      
      // Alignment tags
      html = html.replace(/\[CENTER\]((?:(?!\[CENTER\]).)+?)\[\/CENTER\]/gs, '<div style="text-align:center">$1</div>');
      html = html.replace(/\[RIGHT\]((?:(?!\[RIGHT\]).)+?)\[\/RIGHT\]/gs, '<div style="text-align:right">$1</div>');
      html = html.replace(/\[LEFT\]((?:(?!\[LEFT\]).)+?)\[\/LEFT\]/gs, '<div style="text-align:left">$1</div>');
      
      // Bold tags - match any content including spaces and special chars
      html = html.replace(/\[B\]((?:(?!\[B\]).)+?)\[\/B\]/gs, '<strong>$1</strong>');
      
      // Italic tags
      html = html.replace(/\[I\]((?:(?!\[I\]).)+?)\[\/I\]/gs, '<em>$1</em>');
      
      // Underline tags
      html = html.replace(/\[U\]((?:(?!\[U\]).)+?)\[\/U\]/gs, '<u>$1</u>');
      
      // Strikethrough tags
      html = html.replace(/\[S\]((?:(?!\[S\]).)+?)\[\/S\]/gs, '<s>$1</s>');
      
      // Inline code tags
      html = html.replace(/\[ICODE\]((?:(?!\[ICODE\]).)+?)\[\/ICODE\]/gs, '<code>$1</code>');
      
      // Code block tags
      html = html.replace(/\[CODE\]((?:(?!\[CODE\]).)+?)\[\/CODE\]/gs, '<pre><code>$1</code></pre>');
      
      return html;
    },
  
    // Keyboard shortcuts
    addKeyboardShortcuts(api) {
      document.addEventListener('keydown', async (e) => {
        const editor = document.querySelector('.fr-element');
        if (!editor?.contains(document.activeElement)) return;
  
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const mod = isMac ? e.metaKey : e.ctrlKey;
        if (!mod) return;
  
        for (const preset of Object.values(this.state.presets)) {
          if (!preset.shortcut) continue;
  
          const parts = preset.shortcut.toLowerCase().split('+');
          if (parts[0] === 'cmdorctrl' && 
              parts[parts.length - 1] === e.key.toLowerCase() &&
              parts.includes('shift') === e.shiftKey &&
              parts.includes('alt') === e.altKey) {
            e.preventDefault();
            this.applyPreset(preset, api);
            break;
          }
        }
      });
    },
  
    // Helper: Create element
    el(tag, attrs = {}, children = []) {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'style' || k === 'class') el.setAttribute(k, v);
        else el[k] = v;
      });
      children.forEach(c => c && el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
      return el;
    },
  
    // Helper: Input
    input(label, id, value = '', placeholder = '') {
      return this.el('div', { style: 'margin-bottom:12px' }, [
        this.el('label', { style: 'display:block;margin-bottom:6px;color:#eee;font-size:13px' }, [label]),
        this.el('input', { id, value, placeholder, style: 'width:100%;padding:8px;background:#222;border:1px solid #444;color:#eee;border-radius:4px' })
      ]);
    },
  
    // Helper: Checkbox
    checkbox(label, id, checked = false) {
      const cb = this.el('input', { type: 'checkbox', id });
      if (checked) cb.checked = true;
      return this.el('label', { style: 'display:flex;align-items:center;gap:6px;margin-bottom:8px;color:#eee;cursor:pointer' }, [cb, label]);
    },
  
    // Helper: Select
    select(label, id, options, value = '') {
      const sel = this.el('select', { id, style: 'width:100%;padding:8px;background:#222;border:1px solid #444;color:#eee;border-radius:4px' });
      options.forEach(opt => {
        const option = this.el('option', { value: opt }, [opt || 'None']);
        if (opt === value) option.selected = true;
        sel.appendChild(option);
      });
      return this.el('div', { style: 'margin-bottom:12px' }, [
        this.el('label', { style: 'display:block;margin-bottom:6px;color:#eee;font-size:13px' }, [label]),
        sel
      ]);
    },
  
    // Helper: Color input
    colorInput(label, id, value = '#ffffff') {
      const useColor = this.el('input', { type: 'checkbox', id: 'useColor' });
      if (value) useColor.checked = true;
      return this.el('div', { style: 'margin-bottom:12px' }, [
        this.el('label', { style: 'display:block;margin-bottom:6px;color:#eee;font-size:13px' }, [label]),
        this.el('input', { type: 'color', id, value, style: 'width:100%;height:40px;padding:4px;background:#222;border:1px solid #444;border-radius:4px;cursor:pointer' }),
        this.el('label', { style: 'display:flex;align-items:center;gap:6px;margin-top:6px;color:#eee;cursor:pointer' }, [useColor, 'Use text color'])
      ]);
    },
  
    // Helper: Convert hex to RGB
    hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 255, g: 255, b: 255 };
    }
  };