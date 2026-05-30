'use strict';

const fs   = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '..', '..', 'plugins', 'vencord');

// pluginName → { name, description, enabled, instance }
const pluginRegistry = new Map();

// ── TypeScript / ESM loading ───────────────────────────────────────────────
//
// Vencord plugins use ES module syntax (export default { ... }).
// We can't require() ESM directly in a CJS context, so we:
//   1. For .ts: transform with esbuild.transform() → ESM JS string (in memory)
//   2. For .js: read as-is (already ESM)
//   3. Encode the source as a data: URL and dynamic import() it
//
// This keeps transpiled output entirely in memory — nothing hits disk.

async function loadPluginSource(filePath) {
  let source = fs.readFileSync(filePath, 'utf8');

  if (filePath.endsWith('.ts')) {
    // Lazy-require esbuild so a missing dep only breaks TS plugins, not JS ones
    const esbuild = require('esbuild');
    const result = await esbuild.transform(source, {
      target: 'es2020',
      format: 'esm',
      bundle: false,
      loader: 'ts',
    });
    source = result.code;
  }

  // Dynamic import via data URL — the only way to load ESM in-memory from CJS
  const encoded = encodeURIComponent(source);
  const dataUrl = `data:text/javascript;charset=utf-8,${encoded}`;
  const mod = await import(dataUrl);
  return mod.default ?? mod;
}

// ── Patch application ──────────────────────────────────────────────────────
//
// Vencord patches work at webpack factory evaluation time in a real Vencord
// build. CottonCord intercepts modules after evaluation, so we use
// findByString() to locate the target module and then apply structural patches
// via the patcher. Source-level regex replacements are recorded and logged;
// the full factory-interception path is wired in moduleStore (future).

function applyPatch(pluginName, patch) {
  if (!patch?.find) return;

  const target = window.ModuleStore?.findByString(patch.find);
  if (!target) {
    console.warn(
      `[CottonCord] Vencord patch: module not found for find="${patch.find}" (${pluginName}) — skipping`
    );
    return;
  }

  const { replacement } = patch;
  if (!replacement) return;

  const { match, replace } = replacement;

  // Walk every function-valued property on the module and apply the
  // string/regex replacement to its toString() representation, then
  // rebuild the function via the Function constructor. This is the
  // closest to real Vencord patching we can do post-evaluation.
  const keys = Object.keys(target);
  let applied = false;

  for (const key of keys) {
    const fn = target[key];
    if (typeof fn !== 'function') continue;

    let src;
    try { src = fn.toString(); } catch (_) { continue; }

    const pattern = match instanceof RegExp ? match : new RegExp(escapeRegex(String(match)), 'g');
    if (!pattern.test(src)) continue;

    const patched = src.replace(pattern, replace);
    if (patched === src) continue;

    try {
      // Reconstruct the function from patched source and hot-swap it
      // eslint-disable-next-line no-new-func
      const rebuilt = new Function(`return (${patched})`)();
      if (typeof rebuilt === 'function') {
        target[key] = rebuilt;
        applied = true;
        console.log(
          `[CottonCord] Vencord patch applied: ${pluginName} → ${key} (find="${patch.find}")`
        );
      }
    } catch (err) {
      console.warn(
        `[CottonCord] Vencord patch rebuild failed: ${pluginName} → ${key}:`,
        err.message
      );
    }
  }

  if (!applied) {
    console.warn(
      `[CottonCord] Vencord patch: match not found in module for "${patch.find}" (${pluginName})`
    );
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPatches(plugin, pluginName) {
  if (!Array.isArray(plugin.patches) || plugin.patches.length === 0) return;
  for (const patch of plugin.patches) {
    try {
      applyPatch(pluginName, patch);
    } catch (err) {
      console.error(
        `[CottonCord] Vencord patch error (${pluginName}):`,
        err.message
      );
    }
  }
}

// ── Plugin lifecycle ───────────────────────────────────────────────────────

async function loadPlugin(filePath) {
  const ext        = path.extname(filePath);
  const pluginName = path.basename(filePath, ext);

  try {
    const plugin = await loadPluginSource(filePath);

    if (!plugin || typeof plugin !== 'object') {
      console.warn(`[CottonCord] Vencord plugin "${pluginName}" did not export a default object — skipping`);
      return;
    }

    const name        = plugin.name        ?? pluginName;
    const description = plugin.description ?? '';

    applyPatches(plugin, name);

    try {
      plugin.start?.();
    } catch (startErr) {
      console.error(`[CottonCord] Vencord plugin start() failed (${name}):`, startErr.message);
    }

    pluginRegistry.set(name, { name, description, enabled: true, instance: plugin });
    console.log(`[CottonCord] ✅ Vencord plugin loaded: ${name}`);
  } catch (err) {
    console.error(`[CottonCord] Failed to load Vencord plugin "${pluginName}":`, err.message);
  }
}

async function loadAllPlugins() {
  try {
    if (!fs.existsSync(PLUGINS_DIR)) {
      console.warn('[CottonCord] Vencord plugins directory not found:', PLUGINS_DIR);
      return;
    }

    const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js') || f.endsWith('.ts'));

    if (files.length === 0) {
      console.log('[CottonCord] No Vencord plugins found.');
      return;
    }

    // Load in parallel — plugins are independent of each other
    await Promise.all(files.map(f => loadPlugin(path.join(PLUGINS_DIR, f))));

    console.log(`[CottonCord] Vencord loader: ${pluginRegistry.size} plugin(s) loaded`);
  } catch (err) {
    console.error('[CottonCord] Vencord loader: fatal error during init:', err.message);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

function enablePlugin(name) {
  const entry = pluginRegistry.get(name);
  if (!entry) return console.warn(`[CottonCord] Vencord enablePlugin: no plugin named "${name}"`);
  try {
    applyPatches(entry.instance, name);
    entry.instance.start?.();
    entry.enabled = true;
  } catch (err) {
    console.error(`[CottonCord] Vencord enablePlugin error (${name}):`, err.message);
  }
}

function disablePlugin(name) {
  const entry = pluginRegistry.get(name);
  if (!entry) return console.warn(`[CottonCord] Vencord disablePlugin: no plugin named "${name}"`);
  try {
    entry.instance.stop?.();
    entry.enabled = false;
  } catch (err) {
    console.error(`[CottonCord] Vencord disablePlugin stop() error (${name}):`, err.message);
  }
  try { window.CottonCordPatcher?.unpatchAll(name); } catch (_) {}
}

function reloadPlugin(name) {
  disablePlugin(name);
  enablePlugin(name);
}

function getPlugins() {
  return Array.from(pluginRegistry.values()).map(({ name, description, enabled, instance }) => ({
    name,
    description,
    enabled,
    instance,
  }));
}

function getLoadedCount() { return pluginRegistry.size; }

// ── Boot ───────────────────────────────────────────────────────────────────

loadAllPlugins().catch(err =>
  console.error('[CottonCord] Vencord loader: unhandled async error:', err.message)
);

window.VencordPluginLoader = {
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
