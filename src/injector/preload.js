'use strict';

const path = require('path');
const Module = require('module');

// Register .jsx: transform JSX → React.createElement via esbuild.transformSync
// so UI files can use real JSX syntax without a separate build step.
// Falls back to plain-JS evaluation if esbuild is unavailable.
if (!Module._extensions['.jsx']) {
  let _esbuild = null;
  const _fs = require('fs');
  Module._extensions['.jsx'] = function(mod, filename) {
    let source = _fs.readFileSync(filename, 'utf8');
    try {
      if (!_esbuild) _esbuild = require('esbuild');
      source = _esbuild.transformSync(source, {
        loader:      'jsx',
        jsxFactory:  'React.createElement',
        jsxFragment: 'React.Fragment',
        target:      'es2020',
      }).code;
    } catch (_) { /* fall through — evaluate as plain JS */ }
    mod._compile(source, filename);
  };
}

const ROOT = path.join(__dirname, '..');

function tryLoad(label, modulePath) {
  try {
    return require(modulePath);
  } catch (err) {
    console.error(`[CottonCord] ❌ Failed to load ${label}:`, err.message);
    return null;
  }
}

// ── Load core modules in order ─────────────────────────────────────────────
// Each is isolated so one failure never prevents the rest from loading
const moduleStore    = tryLoad('moduleStore',    path.join(ROOT, 'core',       'moduleStore.js'));
const patcher        = tryLoad('patcher',        path.join(ROOT, 'core',       'patcher.js'));
const bdLoader       = tryLoad('bdLoader',       path.join(ROOT, 'loaders',    'bdLoader.js'));
const vencordLoader  = tryLoad('vencordLoader',  path.join(ROOT, 'loaders',    'vencordLoader.js'));
const vpnManager     = tryLoad('vpnManager',     path.join(ROOT, 'protection', 'vpnManager.js'));
const settingsPanel  = tryLoad('settingsPanel',  path.join(ROOT, 'ui',         'settingsPanel.jsx'));
const autoUpdater    = tryLoad('autoUpdater',    path.join(ROOT, 'updater',    'autoUpdater.js'));
const pluginRegistry = tryLoad('pluginRegistry', path.join(ROOT, 'updater',    'pluginRegistry.js'));

// ── Gather stats (gracefully handles unimplemented stubs) ──────────────────
const webpackCount = moduleStore?.getModuleCount?.()   ?? 0;
const bdCount      = bdLoader?.getLoadedCount?.()      ?? 0;
const vcCount      = vencordLoader?.getLoadedCount?.() ?? 0;
const vpnStatusObj = vpnManager?.getStatus?.();
const vpnStatus    = vpnStatusObj
  ? (vpnStatusObj.connected ? `Connected (${vpnStatusObj.provider})` : 'Disabled')
  : 'Disabled';

// ── Startup log ────────────────────────────────────────────────────────────
console.log('%c✅ CottonCord loaded',              'color:#7289da;font-weight:bold;font-size:13px');
console.log(`%c📦 ${webpackCount} webpack modules found`, 'color:#43b581');
console.log(`%c🟨 ${bdCount} BD plugins loaded`,         'color:#faa61a');
console.log(`%c🟦 ${vcCount} Vencord plugins loaded`,    'color:#5865f2');
console.log(`%c🛡️ IP Protection: ${vpnStatus}`,          'color:#99aab5');

// ── Global API ─────────────────────────────────────────────────────────────
window.CottonCord = {
  version: '1.0.0',

  reload() {
    window.location.reload();
  },

  getLoadedPlugins() {
    return {
      bd:      bdLoader?.getPlugins?.()      ?? [],
      vencord: vencordLoader?.getPlugins?.() ?? [],
    };
  },

  // Expose internals for plugin developers
  modules: moduleStore,
  patcher,
};

// ── Chain Discord's original preload ───────────────────────────────────────
// The injector passes the original preload path via --cc-preload= argv flag
const originalPreloadArg = process.argv.find(a => a.startsWith('--cc-preload='));
if (originalPreloadArg) {
  const originalPreload = originalPreloadArg.slice('--cc-preload='.length);
  try {
    require(originalPreload);
  } catch (err) {
    console.error('[CottonCord] Failed to load Discord original preload:', err.message);
  }
}
