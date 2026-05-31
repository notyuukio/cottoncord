'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const BD_DIR      = path.join(__dirname, '..', '..', 'plugins', 'bd');
const VC_DIR      = path.join(__dirname, '..', '..', 'plugins', 'vencord');
const CONFIG_PATH = path.join(os.homedir(), 'cottoncord-config.json');

// ── Config helpers ──────────────────────────────────────────────────────────

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) { return {}; }
}

function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8'); } catch (_) {}
}

function getMeta() { return loadConfig().customPlugins ?? []; }

function saveMeta(meta) {
  const cfg = loadConfig();
  cfg.customPlugins = meta;
  saveConfig(cfg);
}

// ── Toast ───────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  try {
    let container = document.getElementById('cc-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cc-toast-container';
      Object.assign(container.style, {
        position: 'fixed', bottom: '24px', left: '24px',
        zIndex: '9999', display: 'flex', flexDirection: 'column',
        gap: '8px', pointerEvents: 'none',
      });
      document.body.appendChild(container);
    }
    const colors = { success: '#23a55a', error: '#ed4245', info: '#5865f2', warning: '#f0b132' };
    const el = document.createElement('div');
    Object.assign(el.style, {
      background: '#2f3136', color: '#dcddde',
      borderLeft: `4px solid ${colors[type] ?? colors.info}`,
      borderRadius: '4px', padding: '10px 14px', fontSize: '14px',
      maxWidth: '360px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      transition: 'opacity 0.3s ease', opacity: '1',
    });
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 320);
    }, 3500);
  } catch (_) {}
}

// ── Type detection ──────────────────────────────────────────────────────────

function detectType(content, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.ts') return 'vencord';
  if (/definePlugin\s*\(/.test(content)) return 'vencord';
  if (/import\s+definePlugin\b/.test(content)) return 'vencord';
  return 'betterdiscord';
}

// ── Meta extraction ─────────────────────────────────────────────────────────

function extractMeta(content) {
  let name    = (content.match(/@name\s+(.+)/)           ?? [])[1]?.trim() ?? null;
  let version = (content.match(/@version\s+(\S+)/)       ?? [])[1]?.trim() ?? null;
  let author  = (content.match(/@author\s+(.+)/)         ?? [])[1]?.trim() ?? null;
  let desc    = (content.match(/@description\s+(.+)/)    ?? [])[1]?.trim() ?? null;

  // Vencord definePlugin({ name: '...', description: '...' })
  if (!name) {
    const m = content.match(/definePlugin\s*\(\s*\{[\s\S]*?name\s*:\s*["'`]([^"'`]+)["'`]/);
    if (m) name = m[1];
  }
  if (!desc) {
    const m = content.match(/definePlugin\s*\(\s*\{[\s\S]*?description\s*:\s*["'`]([^"'`]+)["'`]/);
    if (m) desc = m[1];
  }
  // Fallback: config.info.name or getName()
  if (!name) {
    name = (content.match(/["']name["']\s*:\s*["'`]([^"'`]+)["'`]/) ?? [])[1]?.trim() ?? null;
  }
  if (!version) {
    version = (content.match(/["']?version["']?\s*:\s*["']([^"']+)["']/) ?? [])[1]?.trim() ?? null;
  }
  if (!name) {
    name = (content.match(/getName\s*\(\s*\)\s*\{\s*return\s*["'`]([^"'`]+)["'`]/) ?? [])[1]?.trim() ?? null;
  }
  if (!version) {
    version = (content.match(/getVersion\s*\(\s*\)\s*\{\s*return\s*["'`]([^"'`]+)["'`]/) ?? [])[1]?.trim() ?? null;
  }

  return { name, version, author, desc };
}

// ── Validation ──────────────────────────────────────────────────────────────

function validate(content) {
  if (!content || content.length < 100)
    return { ok: false, reason: 'This file does not look like a valid plugin' };

  if (!/module\.exports|class\s+\w|export\s+default|definePlugin/.test(content))
    return { ok: false, reason: 'This file does not look like a valid plugin' };

  if (/\beval\s*\(/.test(content))
    return { ok: false, reason: 'This plugin contains unsafe code and cannot be installed' };

  if (/process\.env\b/.test(content))
    return { ok: false, reason: 'This plugin contains unsafe code and cannot be installed' };

  const escapes = (content.match(/(\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4})/g) ?? []).length;
  if (escapes / (content.length / 4) > 0.08)
    return { ok: false, reason: 'This plugin contains obfuscated code and cannot be installed' };

  if (/findModule\s*\(\s*\d{5,}\s*\)/.test(content))
    return { ok: false, reason: 'This plugin uses hardcoded module IDs that will not work reliably' };

  // Syntax check via esbuild (handles both JS and TS)
  try {
    const esbuild = require('esbuild');
    esbuild.transformSync(content, { loader: 'ts', logLevel: 'silent' });
  } catch (_) {
    return { ok: false, reason: 'This file does not look like a valid plugin (syntax error detected)' };
  }

  return { ok: true };
}

// ── Load a single plugin file immediately (without restart) ─────────────────

async function loadPluginFile(filePath, type) {
  try {
    if (type === 'betterdiscord') {
      await window.BDPluginLoader?.loadPlugin?.(filePath);
    } else {
      await window.VencordPluginLoader?.loadPlugin?.(filePath);
    }
    return { ok: true };
  } catch (err) {
    console.error('[CottonCord] customPluginManager loadPluginFile:', err.message);
    return { ok: false, reason: 'This plugin failed to start — it may not be compatible with your Discord version' };
  }
}

// ── GitHub URL helpers ──────────────────────────────────────────────────────

function normalizeGitHubUrl(url) {
  // blob URL → raw
  const blob = url.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/);
  if (blob) return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}`;
  return url;
}

async function resolveRepoUrl(url) {
  const repo = url.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/?$/);
  if (!repo) return normalizeGitHubUrl(url);
  const slug = repo[1];
  for (const branch of ['main', 'master']) {
    for (const entry of ['index.ts', 'index.js', 'plugin.ts', 'plugin.js']) {
      const raw = `https://raw.githubusercontent.com/${slug}/${branch}/${entry}`;
      try {
        const r = await fetch(raw);
        if (r.ok) return raw;
      } catch (_) {}
    }
  }
  return null;
}

// ── Core install (text content already read) ────────────────────────────────

async function installPlugin(content, filename, sourceUrl) {
  const v = validate(content);
  if (!v.ok) return v;

  const type = detectType(content, filename);
  const { name, version, author, desc } = extractMeta(content);

  const rawId  = name || path.basename(filename, path.extname(filename));
  const id     = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir    = type === 'vencord' ? VC_DIR : BD_DIR;
  const ext    = path.extname(filename) || (type === 'vencord' ? '.ts' : '.js');
  const dest   = path.join(dir, `${id}${ext}`);

  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dest, content, 'utf8');
  } catch (_) {
    return { ok: false, reason: 'This file does not look like a valid plugin (could not save file)' };
  }

  const entry = {
    id, name: name || id,
    version: version || '0.0.0',
    author: author || 'Unknown',
    description: desc || '',
    source: type, file: dest,
    sourceUrl: sourceUrl || null,
    unverified: true, enabled: true,
    installedAt: new Date().toISOString(),
  };
  saveMeta([...getMeta().filter(m => m.id !== id), entry]);

  const load = await loadPluginFile(dest, type);
  if (!load.ok) {
    saveMeta(getMeta().map(m => m.id === id ? { ...m, broken: true } : m));
    return load;
  }

  return { ok: true, entry };
}

// ── Zip install ─────────────────────────────────────────────────────────────

async function installZip(buffer, filename) {
  try {
    const AdmZip = require('adm-zip');
    const zip    = new AdmZip(Buffer.from(buffer));
    const all    = zip.getEntries().filter(e => !e.isDirectory);

    if (all.length === 0)
      return { ok: false, reason: 'This file does not look like a valid plugin (zip is empty)' };

    // Single .js/.ts file
    if (all.length === 1 && /\.(js|ts)$/.test(all[0].entryName)) {
      const content = all[0].getData().toString('utf8');
      return installPlugin(content, all[0].entryName, null);
    }

    // Multi-file Vencord plugin — find entry
    const priority = ['index.ts', 'index.js', 'plugin.ts', 'plugin.js'];
    let entryEntry = null;
    for (const p of priority) {
      entryEntry = all.find(e => e.entryName === p || e.entryName.endsWith('/' + p));
      if (entryEntry) break;
    }
    if (!entryEntry) entryEntry = all.find(e => /\.(js|ts)$/.test(e.entryName));
    if (!entryEntry)
      return { ok: false, reason: 'This file does not look like a valid plugin (no .js or .ts found in zip)' };

    const mainContent = entryEntry.getData().toString('utf8');
    const v = validate(mainContent);
    if (!v.ok) return v;

    const { name } = extractMeta(mainContent);
    const id     = (name || path.basename(filename, '.zip')).replace(/[^a-zA-Z0-9_-]/g, '_');
    const destDir = path.join(VC_DIR, id);

    fs.mkdirSync(destDir, { recursive: true });
    for (const e of all) {
      const abs = path.join(destDir, e.entryName);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, e.getData());
    }

    const entryPath = path.join(destDir, entryEntry.entryName);
    const { version, author, desc } = extractMeta(mainContent);
    const entry = {
      id, name: name || id, version: version || '0.0.0',
      author: author || 'Unknown', description: desc || '',
      source: 'vencord', file: entryPath, sourceUrl: null,
      unverified: true, enabled: true, installedAt: new Date().toISOString(),
    };
    saveMeta([...getMeta().filter(m => m.id !== id), entry]);

    const load = await loadPluginFile(entryPath, 'vencord');
    if (!load.ok) { try { fs.rmSync(destDir, { recursive: true }); } catch (_) {} return load; }
    return { ok: true, entry };
  } catch (err) {
    console.error('[CottonCord] installZip error:', err.message);
    return { ok: false, reason: 'Could not read the zip file — it may be corrupted or unsupported' };
  }
}

// ── Uninstall ───────────────────────────────────────────────────────────────

function uninstallPlugin(id) {
  const entry = getMeta().find(m => m.id === id);
  if (!entry) return;
  try {
    const l = entry.source === 'betterdiscord' ? window.BDPluginLoader : window.VencordPluginLoader;
    l?.disablePlugin?.(entry.name);
  } catch (_) {}
  try {
    if (fs.statSync(entry.file).isDirectory()) fs.rmSync(entry.file, { recursive: true });
    else fs.unlinkSync(entry.file);
  } catch (_) {}
  saveMeta(getMeta().filter(m => m.id !== id));
}

// ── Refresh (re-download) ───────────────────────────────────────────────────

async function refreshPlugin(id) {
  const entry = getMeta().find(m => m.id === id);
  if (!entry?.sourceUrl)
    return { ok: false, reason: 'No source URL stored — cannot refresh this plugin' };
  try {
    const url  = normalizeGitHubUrl(entry.sourceUrl);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const content = await resp.text();
    const v = validate(content);
    if (!v.ok) return v;
    // Stop old
    try {
      const l = entry.source === 'betterdiscord' ? window.BDPluginLoader : window.VencordPluginLoader;
      l?.disablePlugin?.(entry.name);
    } catch (_) {}
    fs.writeFileSync(entry.file, content, 'utf8');
    const load = await loadPluginFile(entry.file, entry.source);
    if (!load.ok) return load;
    const { version } = extractMeta(content);
    saveMeta(getMeta().map(m => m.id === id ? { ...m, version: version || m.version } : m));
    return { ok: true };
  } catch (err) {
    const msg = err.message.startsWith('HTTP')
      ? 'Could not download from that URL — check the link and try again'
      : err.message;
    return { ok: false, reason: msg };
  }
}

// ── Toggle ──────────────────────────────────────────────────────────────────

function enablePlugin(id) {
  const entry = getMeta().find(m => m.id === id);
  if (!entry) return;
  try {
    const l = entry.source === 'betterdiscord' ? window.BDPluginLoader : window.VencordPluginLoader;
    l?.enablePlugin?.(entry.name);
  } catch (_) {}
  saveMeta(getMeta().map(m => m.id === id ? { ...m, enabled: true } : m));
}

function disablePlugin(id) {
  const entry = getMeta().find(m => m.id === id);
  if (!entry) return;
  try {
    const l = entry.source === 'betterdiscord' ? window.BDPluginLoader : window.VencordPluginLoader;
    l?.disablePlugin?.(entry.name);
  } catch (_) {}
  saveMeta(getMeta().map(m => m.id === id ? { ...m, enabled: false } : m));
}

// ── Startup loading ─────────────────────────────────────────────────────────

async function loadAllCustomPlugins() {
  const meta = getMeta();
  if (meta.length === 0) return;
  let loaded = 0;
  for (const entry of meta) {
    if (!entry.enabled) continue;
    try {
      if (!fs.existsSync(entry.file)) {
        console.warn(`[CottonCord] Custom plugin missing on disk: ${entry.name}`);
        continue;
      }
      await loadPluginFile(entry.file, entry.source);
      loaded++;
    } catch (err) {
      console.error(`[CottonCord] Custom plugin failed to load (${entry.name}):`, err.message);
    }
  }
  console.log(`[CottonCord] Custom plugins: ${loaded}/${meta.length} loaded`);
}

function getPlugins()     { return getMeta(); }
function getLoadedCount() { return getMeta().filter(m => m.enabled).length; }

// ── Global exposure ─────────────────────────────────────────────────────────

window.CCCustomPlugins = {
  installPlugin, installZip,
  uninstallPlugin, refreshPlugin,
  enablePlugin, disablePlugin,
  normalizeGitHubUrl, resolveRepoUrl,
  loadAllCustomPlugins,
  getMeta, getPlugins, getLoadedCount, showToast,
};

module.exports = { loadAllCustomPlugins, getPlugins, getLoadedCount };
