/**
 * Logger Utility
 * 
 * Console wrapper with plugin namespacing and log levels.
 */

class Logger {
  constructor(namespace = 'Framework') {
    this.namespace = namespace;
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      NONE: 4
    };
    this.currentLevel = this.levels.INFO;
    this.enabled = true;
  }

  /**
   * Set log level
   * @param {string} level - Log level: 'DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = this.levels[level];
    }
  }

  /**
   * Enable/disable logging
   * @param {boolean} enabled - Enable logging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Format message with namespace
   */
  _format(level, ...args) {
    const timestamp = new Date().toISOString().substring(11, 23);
    return [`[${timestamp}] [${this.namespace}] [${level}]`, ...args];
  }

  /**
   * Log debug message
   */
  debug(...args) {
    if (this.enabled && this.currentLevel <= this.levels.DEBUG) {
      console.debug(...this._format('DEBUG', ...args));
    }
  }

  /**
   * Log info message
   */
  info(...args) {
    if (this.enabled && this.currentLevel <= this.levels.INFO) {
      console.info(...this._format('INFO', ...args));
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    if (this.enabled && this.currentLevel <= this.levels.WARN) {
      console.warn(...this._format('WARN', ...args));
    }
  }

  /**
   * Log error message
   */
  error(...args) {
    if (this.enabled && this.currentLevel <= this.levels.ERROR) {
      console.error(...this._format('ERROR', ...args));
    }
  }

  /**
   * Log generic message
   */
  log(...args) {
    if (this.enabled && this.currentLevel <= this.levels.INFO) {
      console.log(...this._format('LOG', ...args));
    }
  }

  /**
   * Create a child logger with sub-namespace
   * @param {string} subNamespace - Sub-namespace
   * @returns {Logger} Child logger
   */
  child(subNamespace) {
    const child = new Logger(`${this.namespace}:${subNamespace}`);
    child.setLevel(Object.keys(this.levels).find(key => this.levels[key] === this.currentLevel));
    child.setEnabled(this.enabled);
    return child;
  }
}

// Export default logger
export default new Logger('BetterLooksmax');

// Export Logger class for creating custom loggers
export { Logger };
