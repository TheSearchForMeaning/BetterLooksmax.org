# BetterLooksmax Framework - Fixes Summary

## Problems Fixed

### 1. Storage-Runtime Feedback Loop (Oscillation)
**Problem:** Plugins rapidly enabling/disabling in a loop
- Init called `enablePlugin()` → Updated storage → Triggered storage events → Called reconcile → Loop
- `LifecycleManager.startPlugin()` updated storage → Triggered events mid-init
- `LifecycleManager.stopPlugin()` updated storage → Triggered events mid-operation

**Fix 1:** Init now calls `_startPluginRuntime()` directly
- Syncs runtime to storage without updating storage
- No storage events triggered during init
- Clean one-way sync: storage → runtime

**Fix 2:** LifecycleManager NO LONGER updates storage
```javascript
// startPlugin() and stopPlugin() now ONLY manage runtime state
// They don't call this.settings.enable() or this.settings.disable()
// Framework's enablePlugin()/disablePlugin() handle storage separately
```

This eliminates ALL feedback loops between lifecycle and storage.

### 2. Multiple Initializations
**Problem:** Framework initialized multiple times on same URL
- Content script module could be loaded multiple times
- No guard against concurrent init calls
- Storage events during init could trigger re-init

**Fix 1:** Module-level singleton with window storage
```javascript
let framework;

if (window.__BetterLooksmaxFramework) {
  framework = window.__BetterLooksmaxFramework; // Reuse existing
} else {
  framework = new FrameworkCore();
  window.__BetterLooksmaxFramework = framework;
  // Init once with { once: true }
  document.addEventListener('DOMContentLoaded', initOnce, { once: true });
}
```

**Fix 2:** Init guard with warnings
```javascript
async init() {
  if (this.initialized) {
    this.logger.warn('Already initialized, skipping');
    return;
  }
  if (this.initializing) {
    this.logger.warn('Currently initializing, skipping duplicate call');
    return;
  }
  this.initializing = true;
  // ... init logic ...
  this.initialized = true;
  this.initializing = false;
}
```

### 3. Storage Events During Init
**Problem:** Storage changes processed while init still running
- Caused race conditions and oscillation

**Fix:** Storage handler checks `initializing` flag
```javascript
if (this.destroyed || this.initializing || !this.initialized) {
  return; // Don't process
}
```

### 4. IPC Async Lifecycle Issues
**Problem:** 
- Messages sent/received after context destroyed
- "Extension context invalidated" errors
- "Receiving end does not exist" errors
- Uncaught promise rejections

**Fix:** Made IPC lifecycle-aware
- Added `destroyed` flag to IPCManager
- All send/receive operations check lifecycle state
- Pending requests rejected on destroy
- Context invalidation errors silently filtered

### 5. Event Listener Leaks
**Problem:** Event listeners never removed, causing repeated violations

**Fix:** Track and clean up listeners
```javascript
this._eventListeners = [];
// Add listener
this._eventListeners.push({ target, event, handler });
// Remove in destroy()
for (const { target, event, handler } of this._eventListeners) {
  target.removeEventListener(event, handler);
}
```

## Architecture

### Initialization Flow
```
Content script loads
  ↓
framework.init() called
  ↓
Check: initialized || initializing? → return
  ↓
Set initializing = true
  ↓
Load settings from storage
  ↓
Discover & load plugins
  ↓
Register schemas (creates settings entries)
  ↓
Get enabled plugins from storage
  ↓
Start plugins with _startPluginRuntime() (no storage update)
  ↓
Set initialized = true, initializing = false
  ↓
Ready
```

### Storage → Runtime Sync

**During Init:**
```
Storage: { plugin1: enabled, plugin2: enabled }
  ↓
_startPluginRuntime(plugin1) // Direct, no storage update
_startPluginRuntime(plugin2) // Direct, no storage update
  ↓
Runtime: Both running
  ↓
No storage events fired
```

**After Init (User Action):**
```
User enables plugin via popup
  ↓
enablePlugin(id)
  ↓
Update storage (source of truth)
  ↓
Start runtime
  ↓
Storage event fires
  ↓
Handler ignores (operation in-flight)
```

**After Init (External Change):**
```
Another tab enables plugin
  ↓
Storage updated externally
  ↓
Storage event fires
  ↓
No operation in-flight
  ↓
_reconcileEnable(id) // Sync runtime only
```

### Lifecycle States

```javascript
// Framework states
initialized: false → true (stays true until destroy)
initializing: false → true → false (during init only)
destroyed: false → true (permanent)

// IPC states  
destroyed: false → true (permanent)

// Storage handler behavior
if (destroyed || initializing || !initialized) return;
```

### Destroy Sequence
```
destroy() called
  ↓
destroyed = true, initializing = false
  ↓
Clear operations in-flight
  ↓
Clear storage timer
  ↓
ipc.destroy() // Rejects all pending
  ↓
Stop plugins (no IPC)
  ↓
Remove event listeners
  ↓
Clear hooks
```

## Key Principles

1. **Storage is source of truth** - Runtime syncs to storage, not vice versa
2. **Init is read-only** - Reads storage, starts runtime, no storage updates
3. **Commands update both** - enablePlugin() updates storage + runtime
4. **Notifications sync runtime** - _reconcileEnable() only updates runtime
5. **Operations tracked** - Prevent feedback loops
6. **Lifecycle guarded** - All async operations check destroyed/initializing state
7. **Clean teardown** - IPC destroyed first, then plugins stopped

## State Invariants

✅ **Storage = Source of Truth**
- Always check storage first
- Runtime reflects storage state

✅ **No Feedback Loops**
- Init: storage → runtime (no storage update)
- Command: storage + runtime (operation tracked)
- Notification: runtime only (from external storage change)

✅ **Idempotent Operations**
- enablePlugin() on enabled plugin = no-op
- disablePlugin() on disabled plugin = no-op

✅ **Single Init**
- Only one init() executes
- initializing flag prevents concurrent inits

✅ **Clean Shutdown**
- All pending operations rejected
- All listeners removed
- No operations after destroyed=true

## Testing

### Scenario 1: Enable Multiple Plugins
```
User enables plugin1 → Success
User enables plugin2 → Success
Both running, no oscillation
```

### Scenario 2: Enable During Init
```
Init starts
Storage shows plugin1, plugin2 enabled
Both started with _startPluginRuntime()
No storage events
Init completes
Both running
```

### Scenario 3: External Storage Change
```
Init complete, plugin1 running
Another tab enables plugin2
Storage event fires
_reconcileEnable(plugin2) called
plugin2 starts
Both running
```

### Scenario 4: Navigate During Operation
```
User enables plugin
Operation starts
Page navigates
destroy() called
ipc.destroy() rejects pending
No errors in console
```

## Files Modified

1. **src/content.js**
   - Added `initializing` flag
   - Init calls `_startPluginRuntime()` directly (no storage update)
   - Storage handler checks `initializing`
   - Better error handling
   - Proper cleanup

2. **src/core/IPCManager.js**
   - Added `destroyed` flag
   - Guards on all send/receive
   - Proper `destroy()` method
   - Silent context invalidation errors

3. **src/content-loader.js**
   - Debug mode only logging
   - Clean loader

## Verification

- [ ] No oscillation when enabling multiple plugins
- [ ] Framework initializes once per page
- [ ] Both plugins run when both enabled in storage
- [ ] No duplicate logs
- [ ] No "Extension context invalidated" errors
- [ ] No "Receiving end does not exist" errors
- [ ] Clean navigation with no errors
- [ ] Storage changes handled correctly

## Diagnostic Logging

The framework now logs detailed plugin startup:

```
[Core] ✅ 2 plugins enabled in storage: Grey User Filter, Public Mode
[Core] Starting greycel-filter...
[Core] ✓ greycel-filter started successfully
[Core] Starting public-mode...
[Core] ✓ public-mode started successfully
[Core] Started 2/2 plugins
[Core] ✨ Framework ready (2/2 plugins active)
```

If only one starts, you'll see:
```
[Core] Starting greycel-filter...
[Core] ✓ greycel-filter started successfully
[Core] Starting public-mode...
[Core] ✗ public-mode error: [error message]
[Core] Started 1/2 plugins
```

If framework re-initializes, you'll see:
```
[Core] Already initialized, skipping init
```
or
```
[Core] Currently initializing, skipping duplicate call
```

## Debug Mode

Add `?debug=true` to URL for verbose logging:
```
example.com/thread?debug=true
```
