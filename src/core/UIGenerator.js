/**
 * UIGenerator - Automatic settings UI generation
 * 
 * Generates settings interface from plugin schemas with proper
 * input types, validation, and live updates.
 */

import Validators from '../../utils/validators.js';

class UIGenerator {
  constructor() {
    this.inputHandlers = new Map();
  }

  /**
   * Generate settings panel for a plugin
   * @param {string} pluginId - Plugin ID
   * @param {object} schema - Settings schema
   * @param {object} currentValues - Current setting values
   * @param {Function} onChange - Called when setting changes (key, value)
   * @returns {HTMLElement} Generated settings panel
   */
  generateSettingsPanel(pluginId, schema, currentValues = {}, onChange = null) {
    const container = document.createElement('div');
    container.className = 'settings-panel';
    container.dataset.pluginId = pluginId;

    // Group settings by section if defined
    const sections = this._groupBySection(schema);

    sections.forEach(({ title, settings }) => {
      const section = this._createSection(title, settings, currentValues, onChange);
      container.appendChild(section);
    });

    return container;
  }

  /**
   * Group settings by section
   */
  _groupBySection(schema) {
    const sections = new Map();
    sections.set('General', []);

    Object.entries(schema).forEach(([key, definition]) => {
      const section = definition.section || 'General';
      if (!sections.has(section)) {
        sections.set(section, []);
      }
      sections.get(section).push({ key, ...definition });
    });

    return Array.from(sections.entries()).map(([title, settings]) => ({
      title,
      settings
    }));
  }

  /**
   * Create a settings section
   */
  _createSection(title, settings, currentValues, onChange) {
    const section = document.createElement('div');
    section.className = 'settings-section';

    if (title) {
      const header = document.createElement('h3');
      header.className = 'settings-section-header';
      header.textContent = title;
      section.appendChild(header);
    }

    const body = document.createElement('div');
    body.className = 'settings-section-body';

    settings.forEach(setting => {
      const row = this._createSettingRow(setting, currentValues, onChange);
      if (row) {
        body.appendChild(row);
      }
    });

    section.appendChild(body);
    return section;
  }

  /**
   * Create a single setting row
   */
  _createSettingRow(setting, currentValues, onChange) {
    const { key, title, description, type, visible } = setting;

    // Check conditional visibility
    if (visible && typeof visible === 'function') {
      if (!visible(currentValues)) {
        return null;
      }
    }

    const row = document.createElement('div');
    row.className = 'setting-row';
    row.dataset.key = key;
    row.dataset.type = type;

    const info = document.createElement('div');
    info.className = 'setting-info';

    const label = document.createElement('label');
    label.className = 'setting-label';
    label.textContent = title || key;
    label.htmlFor = `setting-${key}`;
    info.appendChild(label);

    if (description) {
      const desc = document.createElement('span');
      desc.className = 'setting-description';
      desc.textContent = description;
      info.appendChild(desc);
    }

    row.appendChild(info);

    const control = document.createElement('div');
    control.className = 'setting-control';

    const input = this._createInput(setting, currentValues[key], (value) => {
      if (onChange) {
        onChange(key, value);
      }
    });

    control.appendChild(input);
    row.appendChild(control);

    return row;
  }

  /**
   * Create input element based on type
   */
  _createInput(setting, currentValue, onChange) {
    const { type, key } = setting;

    switch (type) {
      case 'boolean':
        return this._createToggle(setting, currentValue, onChange);
      case 'string':
        return this._createTextInput(setting, currentValue, onChange);
      case 'number':
        return this._createNumberInput(setting, currentValue, onChange);
      case 'select':
      case 'enum':
        return this._createSelect(setting, currentValue, onChange);
      case 'color':
        return this._createColorPicker(setting, currentValue, onChange);
      case 'array':
        return this._createMultiSelect(setting, currentValue, onChange);
      default:
        return this._createTextInput(setting, currentValue, onChange);
    }
  }

  /**
   * Create toggle switch for boolean
   */
  _createToggle(setting, currentValue, onChange) {
    const { key, default: defaultValue } = setting;
    const value = currentValue !== undefined ? currentValue : defaultValue;

    const label = document.createElement('label');
    label.className = 'toggle-switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `setting-${key}`;
    input.checked = value;
    
    input.addEventListener('change', () => {
      onChange(input.checked);
    });

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    label.appendChild(input);
    label.appendChild(slider);

    return label;
  }

  /**
   * Create text input for string
   */
  _createTextInput(setting, currentValue, onChange) {
    const { key, default: defaultValue, placeholder, maxlength } = setting;
    const value = currentValue !== undefined ? currentValue : defaultValue || '';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `setting-${key}`;
    input.className = 'text-input';
    input.value = value;
    
    if (placeholder) input.placeholder = placeholder;
    if (maxlength) input.maxLength = maxlength;

    input.addEventListener('input', () => {
      onChange(input.value);
    });

    return input;
  }

  /**
   * Create number input with optional slider
   */
  _createNumberInput(setting, currentValue, onChange) {
    const { key, default: defaultValue, min, max, step, slider } = setting;
    const value = currentValue !== undefined ? currentValue : defaultValue || 0;

    const container = document.createElement('div');
    container.className = 'number-input-container';

    const input = document.createElement('input');
    input.type = slider ? 'range' : 'number';
    input.id = `setting-${key}`;
    input.className = slider ? 'range-input' : 'number-input';
    input.value = value;
    
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;

    const display = document.createElement('span');
    display.className = 'number-display';
    display.textContent = value;

    input.addEventListener('input', () => {
      const numValue = parseFloat(input.value);
      display.textContent = numValue;
      onChange(numValue);
    });

    container.appendChild(input);
    if (slider) {
      container.appendChild(display);
    }

    return container;
  }

  /**
   * Create select dropdown for enum
   */
  _createSelect(setting, currentValue, onChange) {
    const { key, default: defaultValue, enum: options } = setting;
    const value = currentValue !== undefined ? currentValue : defaultValue;

    const select = document.createElement('select');
    select.id = `setting-${key}`;
    select.className = 'select-input';

    (options || []).forEach(option => {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      if (option === value) {
        optionEl.selected = true;
      }
      select.appendChild(optionEl);
    });

    select.addEventListener('change', () => {
      onChange(select.value);
    });

    return select;
  }

  /**
   * Create color picker
   */
  _createColorPicker(setting, currentValue, onChange) {
    const { key, default: defaultValue } = setting;
    const value = currentValue !== undefined ? currentValue : defaultValue || '#000000';

    const container = document.createElement('div');
    container.className = 'color-picker-container';

    const input = document.createElement('input');
    input.type = 'color';
    input.id = `setting-${key}`;
    input.className = 'color-input';
    input.value = value;

    const display = document.createElement('input');
    display.type = 'text';
    display.className = 'color-text-input';
    display.value = value;
    display.maxLength = 7;

    input.addEventListener('input', () => {
      display.value = input.value;
      onChange(input.value);
    });

    display.addEventListener('input', () => {
      if (Validators.validateColor(display.value)) {
        input.value = display.value;
        onChange(display.value);
      }
    });

    container.appendChild(input);
    container.appendChild(display);

    return container;
  }

  /**
   * Create multi-select for array
   */
  _createMultiSelect(setting, currentValue, onChange) {
    const { key, default: defaultValue, options } = setting;
    const values = currentValue !== undefined ? currentValue : defaultValue || [];

    const container = document.createElement('div');
    container.className = 'multi-select-container';

    const selectedContainer = document.createElement('div');
    selectedContainer.className = 'selected-items';

    const updateDisplay = () => {
      selectedContainer.innerHTML = '';
      values.forEach(value => {
        const tag = document.createElement('span');
        tag.className = 'selected-tag';
        tag.textContent = value;

        const remove = document.createElement('button');
        remove.textContent = '×';
        remove.className = 'remove-tag';
        remove.addEventListener('click', () => {
          const index = values.indexOf(value);
          if (index > -1) {
            values.splice(index, 1);
            updateDisplay();
            onChange([...values]);
          }
        });

        tag.appendChild(remove);
        selectedContainer.appendChild(tag);
      });
    };

    if (options) {
      const select = document.createElement('select');
      select.className = 'multi-select-input';

      const placeholder = document.createElement('option');
      placeholder.textContent = 'Select...';
      placeholder.value = '';
      select.appendChild(placeholder);

      options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        select.appendChild(optionEl);
      });

      select.addEventListener('change', () => {
        if (select.value && !values.includes(select.value)) {
          values.push(select.value);
          updateDisplay();
          onChange([...values]);
          select.value = '';
        }
      });

      container.appendChild(select);
    }

    container.appendChild(selectedContainer);
    updateDisplay();

    return container;
  }

  /**
   * Generate plugin card for dashboard
   * @param {object} pluginInfo - Plugin information
   * @param {boolean} enabled - Is plugin enabled
   * @param {Function} onToggle - Toggle callback
   * @param {Function} onSettings - Settings callback
   * @returns {HTMLElement} Plugin card
   */
  generatePluginCard(pluginInfo, enabled, onToggle, onSettings) {
    const { id, name, description, version, author, category, tags } = pluginInfo;

    const card = document.createElement('div');
    card.className = `plugin-card ${enabled ? 'enabled' : 'disabled'}`;
    card.dataset.pluginId = id;
    card.dataset.category = category || 'other';

    const header = document.createElement('div');
    header.className = 'plugin-card-header';

    const title = document.createElement('h3');
    title.className = 'plugin-card-title';
    title.textContent = name;

    const version_badge = document.createElement('span');
    version_badge.className = 'plugin-version';
    version_badge.textContent = version;

    header.appendChild(title);
    header.appendChild(version_badge);

    const body = document.createElement('div');
    body.className = 'plugin-card-body';

    const desc = document.createElement('p');
    desc.className = 'plugin-description';
    desc.textContent = description;
    body.appendChild(desc);

    if (author) {
      const authorEl = document.createElement('p');
      authorEl.className = 'plugin-author';
      authorEl.textContent = `by ${author}`;
      body.appendChild(authorEl);
    }

    if (tags && tags.length > 0) {
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'plugin-tags';
      tags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'plugin-tag';
        tagEl.textContent = tag;
        tagsContainer.appendChild(tagEl);
      });
      body.appendChild(tagsContainer);
    }

    const footer = document.createElement('div');
    footer.className = 'plugin-card-footer';

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'plugin-settings-btn';
    settingsBtn.textContent = 'Settings';
    settingsBtn.addEventListener('click', () => onSettings(id));

    const toggle = document.createElement('label');
    toggle.className = 'toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = enabled;
    checkbox.addEventListener('change', () => onToggle(id, checkbox.checked));

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggle.appendChild(checkbox);
    toggle.appendChild(slider);

    footer.appendChild(settingsBtn);
    footer.appendChild(toggle);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
  }

  /**
   * Update input value programmatically
   * @param {HTMLElement} container - Settings panel container
   * @param {string} key - Setting key
   * @param {*} value - New value
   */
  updateInputValue(container, key, value) {
    const row = container.querySelector(`.setting-row[data-key="${key}"]`);
    if (!row) return;

    const input = row.querySelector('input, select');
    if (!input) return;

    const type = row.dataset.type;

    switch (type) {
      case 'boolean':
        input.checked = value;
        break;
      case 'number':
        input.value = value;
        const display = row.querySelector('.number-display');
        if (display) display.textContent = value;
        break;
      default:
        input.value = value;
    }
  }
}

// Export singleton instance
export default new UIGenerator();
