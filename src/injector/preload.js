'use strict';

const path   = require('path');
const Module = require('module');

// ── .jsx handler ───────────────────────────────────────────────────────────
// Transforms JSX → React.createElement via esbuild.transformSync so UI files
// can use real JSX without a separate build step. Falls back to plain JS.
if (!Module._extensions['.jsx']) {
  let _esbuild = null;
  const _fs = require('fs');
  Module._extensions['.jsx'] = function (mod, filename) {
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

// ── Chain Discord's original preload (sync, before any await) ─────────────
// Must run before our async work so that Discord's page can start loading,
// which causes webpack to initialize — our moduleStore then captures it.
const _originalPreloadArg = process.argv.find(a => a.startsWith('--cc-preload='));
if (_originalPreloadArg) {
  const _originalPreload = _originalPreloadArg.slice('--cc-preload='.length);
  try {
    require(_originalPreload);
  } catch (err) {
    console.error('[CottonCord] Failed to chain Discord preload:', err.message);
  }
}

// ── Async bootstrap ────────────────────────────────────────────────────────

function poll(predicate, intervalMs = 100, maxAttempts = 300) {
  return new Promise((resolve, reject) => {
    if (predicate()) { resolve(); return; }
    let n = 0;
    const t = setInterval(() => {
      if (predicate()) { clearInterval(t); resolve(); }
      else if (++n >= maxAttempts) { clearInterval(t); reject(new Error('timed out')); }
    }, intervalMs);
  });
}

(async () => {
  // 1 ── moduleStore: kick off webpack capture then wait for it to complete
  try {
    require(path.join(ROOT, 'core', 'moduleStore.js'));
    await poll(() => (window.ModuleStore?.getModuleCount?.() ?? 0) > 0);
  } catch (err) {
    console.error('[CottonCord] ❌ moduleStore:', err.message);
  }

  // 2 ── patcher
  try {
    require(path.join(ROOT, 'core', 'patcher.js'));
  } catch (err) {
    console.error('[CottonCord] ❌ patcher:', err.message);
  }

  // 3 ── vpnManager + restore saved connection
  try {
    require(path.join(ROOT, 'protection', 'vpnManager.js'));
    await window.CottonCordVPN?.loadSavedConfig?.();
  } catch (err) {
    console.error('[CottonCord] ❌ vpnManager:', err.message);
  }

  // 4 ── BD plugin loader
  try {
    require(path.join(ROOT, 'loaders', 'bdLoader.js'));
  } catch (err) {
    console.error('[CottonCord] ❌ bdLoader:', err.message);
  }

  // 5 ── Vencord plugin loader
  try {
    require(path.join(ROOT, 'loaders', 'vencordLoader.js'));
  } catch (err) {
    console.error('[CottonCord] ❌ vencordLoader:', err.message);
  }

  // 6 ── Settings panel (injects into Discord sidebar)
  try {
    require(path.join(ROOT, 'ui', 'settingsPanel.jsx'));
  } catch (err) {
    console.error('[CottonCord] ❌ settingsPanel:', err.message);
  }

  // 7 ── Auto updater (has internal 5 s delay before hitting GitHub)
  try {
    require(path.join(ROOT, 'updater', 'autoUpdater.js'));
  } catch (err) {
    console.error('[CottonCord] ❌ autoUpdater:', err.message);
  }

  // 8 ── Plugin registry (has internal 10 s delay before fetching)
  try {
    require(path.join(ROOT, 'updater', 'pluginRegistry.js'));
  } catch (err) {
    console.error('[CottonCord] ❌ pluginRegistry:', err.message);
  }

  // ── window.CottonCord global API ──────────────────────────────────────────
  window.CottonCord = {
    version: '1.0.0',

    reload() { window.location.reload(); },

    getLoadedPlugins() {
      return {
        bd:      window.BDPluginLoader?.getPlugins?.()      ?? [],
        vencord: window.VencordPluginLoader?.getPlugins?.() ?? [],
      };
    },

    modules: window.ModuleStore,
    patcher: window.CottonCordPatcher,
  };

  // ── Startup banner ────────────────────────────────────────────────────────
  const version  = '1.0.0';
  const webpack  = window.ModuleStore?.getModuleCount?.()         ?? 0;
  const bdCount  = window.BDPluginLoader?.getLoadedCount?.()      ?? 0;
  const vcCount  = window.VencordPluginLoader?.getLoadedCount?.() ?? 0;
  const vpnOn    = window.CottonCordVPN?.getStatus?.()?.connected ?? false;
  const ipStatus = vpnOn ? 'Protected' : 'Unprotected';
  const bar      = '━'.repeat(25);

  console.log(
    `%c${bar}\n  CottonCord v${version} 🐰\n${bar}\n` +
    `  📦 [${webpack}] webpack modules\n` +
    `  🟨 [${bdCount}] BD plugins\n` +
    `  🟦 [${vcCount}] Vencord plugins\n` +
    `  🛡️  IP: ${ipStatus}\n` +
    bar,
    'color:#7289da;font-weight:bold;font-size:12px',
  );
})().catch(err => {
  console.error('[CottonCord] Fatal bootstrap error:', err);
});
