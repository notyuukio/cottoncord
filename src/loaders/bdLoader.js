'use strict';

const fs   = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '..', '..', 'plugins', 'bd');
const DATA_DIR    = path.join(PLUGINS_DIR, 'data');

// Ensure the data directory exists so saves never throw on first use
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

// pluginName → { name, enabled, instance }
const pluginRegistry = new Map();

// ── BdApi.Data ─────────────────────────────────────────────────────────────
// Persists plugin settings to plugins/bd/data/<pluginName>.json

function dataLoad(pluginName, key) {
  try {
    const file = path.join(DATA_DIR, `${pluginName}.json`);
    if (!fs.existsSync(file)) return undefined;
    const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    return key != null ? obj[key] : obj;
  } catch (err) {
    console.error(`[CottonCord] BdApi.Data.load error (${pluginName}/${key}):`, err.message);
    return undefined;
  }
}

function dataSave(pluginName, key, value) {
  try {
    const file = path.join(DATA_DIR, `${pluginName}.json`);
    let obj = {};
    if (fs.existsSync(file)) {
      try { obj = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
    }
    obj[key] = value;
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error(`[CottonCord] BdApi.Data.save error (${pluginName}/${key}):`, err.message);
  }
}

// ── BdApi.UI ───────────────────────────────────────────────────────────────
// Injects a minimal Discord-style toast into the bottom-left of the window.
// A proper implementation waits for the DOM; this runs in preload context.

function ensureToastContainer() {
  let container = document.getElementById('cc-toast-container');
  if (container) return container;

  container = document.createElement('div');
  container.id = 'cc-toast-container';
  Object.assign(container.style, {
    position:      'fixed',
    bottom:        '24px',
    left:          '24px',
    zIndex:        '9999',
    display:       'flex',
    flexDirection: 'column',
    gap:           '8px',
    pointerEvents: 'none',
  });
  document.body.appendChild(container);
  return container;
}

function showToast(message, options = {}) {
  try {
    const { type = 'info', timeout = 3500 } = options;

    const colorMap = { info: '#5865f2', success: '#43b581', warning: '#faa61a', error: '#ed4245' };
    const color = colorMap[type] ?? colorMap.info;

    const toast = document.createElement('div');
    Object.assign(toast.style, {
      background:   '#2f3136',
      color:        '#dcddde',
      borderLeft:   `4px solid ${color}`,
      borderRadius: '4px',
      padding:      '10px 14px',
      fontSize:     '14px',
      maxWidth:     '340px',
      opacity:      '1',
      transition:   'opacity 0.3s ease',
      pointerEvents:'none',
      boxShadow:    '0 2px 8px rgba(0,0,0,0.4)',
    });
    toast.textContent = message;

    const container = ensureToastContainer();
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { try { container.removeChild(toast); } catch (_) {} }, 320);
    }, timeout);
  } catch (err) {
    console.error('[CottonCord] BdApi.UI.showToast error:', err.message);
  }
}

// ── BdApi.DOM ──────────────────────────────────────────────────────────────

function addStyle(id, css) {
  try {
    removeStyle(id); // remove existing tag with same id first
    const el = document.createElement('style');
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  } catch (err) {
    console.error(`[CottonCord] BdApi.DOM.addStyle error (${id}):`, err.message);
  }
}

function removeStyle(id) {
  try {
    document.getElementById(id)?.remove();
  } catch (err) {
    console.error(`[CottonCord] BdApi.DOM.removeStyle error (${id}):`, err.message);
  }
}

// ── BdApi factory ──────────────────────────────────────────────────────────
// Each plugin gets its own BdApi instance so Patcher.unpatchAll can be
// scoped to that plugin's name automatically.

function makeBdApi(pluginName) {
  return {
    Webpack: {
      getModule:        (filter)       => window.ModuleStore?.find(filter),
      getByProps:       (...props)     => window.ModuleStore?.findByProps(...props),
      getByDisplayName: (name)         => window.ModuleStore?.findByDisplayName(name),
      getByString:      (str)          => window.ModuleStore?.findByString(str),
    },
    Patcher: {
      before:     (caller, obj, method, cb) => window.CottonCordPatcher?.before(caller, obj, method, cb),
      after:      (caller, obj, method, cb) => window.CottonCordPatcher?.after(caller, obj, method, cb),
      instead:    (caller, obj, method, cb) => window.CottonCordPatcher?.instead(caller, obj, method, cb),
      unpatchAll: (caller)                  => window.CottonCordPatcher?.unpatchAll(caller ?? pluginName),
    },
    Data: {
      load:  (key)        => dataLoad(pluginName, key),
      save:  (key, value) => dataSave(pluginName, key, value),
    },
    UI: {
      showToast,
    },
    DOM: {
      addStyle,
      removeStyle,
    },
  };
}

// ── Plugin loading ─────────────────────────────────────────────────────────

function loadPlugin(filePath) {
  const pluginName = path.basename(filePath, '.js');

  try {
    const source = fs.readFileSync(filePath, 'utf8');

    // Evaluate the plugin source to get a constructor.
    // BD plugins export a class/function. The standard format is:
    //   module.exports = class MyPlugin { constructor(api) {} start() {} stop() {} }
    // We support both module.exports assignments and bare class expressions.
    const pluginModule = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('require', 'module', 'exports', '__filename', '__dirname', source)(
      require,
      pluginModule,
      pluginModule.exports,
      filePath,
      path.dirname(filePath)
    );

    const PluginClass = pluginModule.exports?.default ?? pluginModule.exports;

    if (typeof PluginClass !== 'function') {
      console.warn(`[CottonCord] BD plugin "${pluginName}" did not export a class/constructor — skipping`);
      return;
    }

    const bdApi    = makeBdApi(pluginName);
    const instance = new PluginClass(bdApi);

    pluginRegistry.set(pluginName, { name: pluginName, enabled: false, instance });

    try {
      instance.start?.();
      pluginRegistry.get(pluginName).enabled = true;
      console.log(`[CottonCord] ✅ BD plugin loaded: ${pluginName}`);
    } catch (startErr) {
      console.error(`[CottonCord] BD plugin start() failed (${pluginName}):`, startErr.message);
    }
  } catch (err) {
    console.error(`[CottonCord] Failed to load BD plugin "${pluginName}":`, err.message);
  }
}

function loadAllPlugins() {
  try {
    if (!fs.existsSync(PLUGINS_DIR)) {
      console.warn('[CottonCord] BD plugins directory not found:', PLUGINS_DIR);
      return;
    }

    // Sort so 0BDFDB.plugin.js loads before all dependent plugins
    const files = fs.readdirSync(PLUGINS_DIR)
      .filter(f => f.endsWith('.js'))
      .sort();

    if (files.length === 0) {
      console.log('[CottonCord] No BD plugins found.');
      return;
    }

    for (const file of files) {
      loadPlugin(path.join(PLUGINS_DIR, file));
    }

    console.log(`[CottonCord] BD loader: ${pluginRegistry.size} plugin(s) loaded`);
  } catch (err) {
    console.error('[CottonCord] BD loader: fatal error during init:', err.message);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

function enablePlugin(name) {
  const entry = pluginRegistry.get(name);
  if (!entry) return console.warn(`[CottonCord] enablePlugin: no plugin named "${name}"`);
  try {
    entry.instance.start?.();
    entry.enabled = true;
  } catch (err) {
    console.error(`[CottonCord] enablePlugin error (${name}):`, err.message);
  }
}

function disablePlugin(name) {
  const entry = pluginRegistry.get(name);
  if (!entry) return console.warn(`[CottonCord] disablePlugin: no plugin named "${name}"`);
  try {
    entry.instance.stop?.();
    entry.enabled = false;
  } catch (err) {
    console.error(`[CottonCord] disablePlugin stop() error (${name}):`, err.message);
  }
  // Always clean up patches regardless of whether stop() threw
  try { window.CottonCordPatcher?.unpatchAll(name); } catch (_) {}
}

function reloadPlugin(name) {
  disablePlugin(name);
  enablePlugin(name);
}

function getPlugins() {
  return Array.from(pluginRegistry.values()).map(({ name, enabled, instance }) => ({
    name,
    enabled,
    instance,
  }));
}

function getLoadedCount() { return pluginRegistry.size; }

// ── Boot ───────────────────────────────────────────────────────────────────

loadAllPlugins();

window.BDPluginLoader = {
  getPlugins,
  enablePlugin,
  disablePlugin,
  reloadPlugin,
  getPluginCount: getLoadedCount,
};

module.exports = {
  getPlugins,
  enablePlugin,
  disablePlugin,
  reloadPlugin,
  getLoadedCount,
};
