'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const REGISTRY_URL   = 'https://raw.githubusercontent.com/notyuukio/cottoncord/main/plugin-registry.json';
const STARTUP_DELAY  = 10_000; // ms — give Discord + other loaders time to settle
const BD_PLUGINS_DIR = path.join(__dirname, '..', '..', 'plugins', 'bd');
const VC_PLUGINS_DIR = path.join(__dirname, '..', '..', 'plugins', 'vencord');

let cachedRegistry = null; // full fetched registry object

// ── Helpers ────────────────────────────────────────────────────────────────

function isNewer(remoteVersion, localVersion) {
  const parse = v => String(v).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const r = parse(remoteVersion);
  const l = parse(localVersion);
  for (let i = 0; i < 3; i++) {
    if ((r[i] ?? 0) > (l[i] ?? 0)) return true;
    if ((r[i] ?? 0) < (l[i] ?? 0)) return false;
  }
  return false;
}

// Follow redirects; resolve with the response body as a string.
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      const parsed = new URL(u);
      https.get(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
          headers: { 'User-Agent': 'CottonCord/PluginRegistry' } },
        (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            get(res.headers.location);
            return;
          }
          let body = '';
          res.on('data', c => { body += c; });
          res.on('end', () => resolve(body));
          res.on('error', reject);
        }
      ).on('error', reject);
    };
    get(url);
  });
}

// ── Toast ──────────────────────────────────────────────────────────────────

function showToast(message, color = '#5865f2') {
  try {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:24px', 'z-index:9999',
      'background:#2f3136', 'color:#dcddde',
      `border-left:4px solid ${color}`, 'border-radius:4px',
      'padding:10px 14px', 'font-size:14px', 'max-width:380px',
      'box-shadow:0 2px 8px rgba(0,0,0,.4)',
      'transition:opacity .3s ease', 'pointer-events:none',
    ].join(';');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 320);
    }, 6000);
  } catch (_) {}
}

// ── Version reading from installed plugin files ────────────────────────────
// BD plugins put @version in a JSDoc-style comment block.
// Vencord plugins put version in their exported default object.
// We do a best-effort parse without fully evaluating the file.

function readInstalledVersion(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').slice(0, 2048);
    // BD-style: * @version 1.2.3
    const bdMatch = content.match(/@version\s+([\d.]+)/);
    if (bdMatch) return bdMatch[1];
    // Vencord-style: version: "1.2.3"
    const vcMatch = content.match(/version\s*:\s*["'`]([\d.]+)["'`]/);
    if (vcMatch) return vcMatch[1];
  } catch (_) {}
  return null;
}

// ── Plugin file lookup ─────────────────────────────────────────────────────

function findInstalledFile(pluginName, source) {
  const dirs   = source === 'betterdiscord' ? [BD_PLUGINS_DIR] : [VC_PLUGINS_DIR];
  const exts   = ['.js', '.ts'];
  const basenames = [pluginName, pluginName.toLowerCase()];

  for (const dir of dirs) {
    for (const base of basenames) {
      for (const ext of exts) {
        const candidate = path.join(dir, base + ext);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

// ── Download a plugin file ─────────────────────────────────────────────────

async function downloadPlugin(downloadUrl, destPath) {
  const content = await fetchText(downloadUrl);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, content, 'utf8');
}

// ── Disable a plugin via the appropriate loader ────────────────────────────

function disablePlugin(pluginName, source) {
  try {
    if (source === 'betterdiscord') {
      window.BDPluginLoader?.disablePlugin(pluginName);
    } else {
      window.VencordPluginLoader?.disablePlugin(pluginName);
    }
  } catch (_) {}
}

function isPluginEnabled(pluginName, source) {
  try {
    const loader = source === 'betterdiscord'
      ? window.BDPluginLoader
      : window.VencordPluginLoader;
    const plugins = loader?.getPlugins() ?? [];
    return plugins.some(p => p.name === pluginName && p.enabled);
  } catch (_) {
    return false;
  }
}

// ── Conflict resolution ────────────────────────────────────────────────────
// When two conflicting plugins are both enabled, disable the one that appears
// later in the registry list (lower priority = higher index).

function checkConflicts(plugins) {
  const conflicts = [];
  const enabledByName = new Map();

  for (const plugin of plugins) {
    if (isPluginEnabled(plugin.name, plugin.source)) {
      enabledByName.set(plugin.name, plugin);
    }
  }

  const handled = new Set();

  for (const plugin of plugins) {
    if (!plugin.conflictsWith?.length) continue;
    if (!enabledByName.has(plugin.name)) continue;

    for (const conflictName of plugin.conflictsWith) {
      const pairKey = [plugin.name, conflictName].sort().join('|');
      if (handled.has(pairKey)) continue;

      if (enabledByName.has(conflictName)) {
        handled.add(pairKey);
        const conflictPlugin = enabledByName.get(conflictName);
        // Lower-priority = appears later in the registry list (higher index)
        const pluginIdx   = plugins.indexOf(plugin);
        const conflictIdx = plugins.indexOf(conflictPlugin);
        const loser = pluginIdx > conflictIdx ? plugin : conflictPlugin;
        const winner = loser === plugin ? conflictPlugin : plugin;

        conflicts.push({ disabled: loser.name, keptEnabled: winner.name });
        disablePlugin(loser.name, loser.source);
        enabledByName.delete(loser.name);
      }
    }
  }

  return conflicts;
}

// ── Main registry processing ───────────────────────────────────────────────

async function processRegistry(registry) {
  const plugins = registry.plugins ?? [];
  let updated  = 0;
  let disabled = 0;

  for (const plugin of plugins) {
    const { name, version, source, downloadUrl, broken, conflictsWith } = plugin;

    // ── Broken flag ────────────────────────────────────────────────────────
    if (broken) {
      if (isPluginEnabled(name, source)) {
        disablePlugin(name, source);
        disabled++;
        showToast(
          `${name} was disabled — incompatible with current Discord version`,
          '#ed4245'
        );
      }
      continue; // skip update check for broken plugins
    }

    // ── Version update check ───────────────────────────────────────────────
    const installedFile = findInstalledFile(name, source);
    if (!installedFile) continue; // plugin not installed locally, skip

    const installedVersion = readInstalledVersion(installedFile);
    if (!installedVersion || !isNewer(version, installedVersion)) continue;

    try {
      await downloadPlugin(downloadUrl, installedFile);
      updated++;
    } catch (_) {
      // Silent — a failed download doesn't block other plugins
    }
  }

  // ── Conflict resolution (runs after broken/update pass) ───────────────────
  const conflicts = checkConflicts(plugins);
  for (const { disabled: disabledName, keptEnabled } of conflicts) {
    disabled++;
    showToast(
      `${disabledName} was disabled — conflicts with ${keptEnabled}`,
      '#faa61a'
    );
  }

  // ── Summary toast (only if something changed) ──────────────────────────────
  if (updated > 0 || disabled > 0) {
    const parts = [];
    if (updated  > 0) parts.push(`${updated} plugin${updated  > 1 ? 's' : ''} updated`);
    if (disabled > 0) parts.push(`${disabled} plugin${disabled > 1 ? 's' : ''} disabled`);
    showToast(`CottonCord: ${parts.join(', ')}`, '#43b581');
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

function getRegistry()    { return cachedRegistry; }
function getLastUpdated() { return cachedRegistry?.lastUpdated ?? null; }

function markBroken(pluginName) {
  // Client-side marker only — a registry maintainer must push the real flag.
  // Useful for local testing of the broken-plugin disable flow.
  if (!cachedRegistry) return;
  const plugin = cachedRegistry.plugins?.find(p => p.name === pluginName);
  if (plugin) plugin.broken = true;
}

function checkConflictsPublic() {
  if (!cachedRegistry) return [];
  return checkConflicts(cachedRegistry.plugins ?? []);
}

// ── Boot ───────────────────────────────────────────────────────────────────

async function run() {
  try {
    const body = await fetchText(REGISTRY_URL);
    const registry = JSON.parse(body);
    cachedRegistry = registry;
    await processRegistry(registry);
  } catch (_) {
    // Fetch failure, parse failure, or processing error — all silent.
  }
}

setTimeout(run, STARTUP_DELAY);

window.PluginRegistry = {
  getRegistry,
  markBroken,
  checkConflicts: checkConflictsPublic,
  getLastUpdated,
};

module.exports = {
  getRegistry,
  markBroken,
  checkConflicts: checkConflictsPublic,
  getLastUpdated,
};
