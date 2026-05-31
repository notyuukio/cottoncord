'use strict';

const fs   = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '..', '..', 'plugins', 'vencord');

// pluginName → { name, description, enabled, instance, tags, authors }
const pluginRegistry = new Map();

// ── Vencord shim ESM content injected by the esbuild plugin ───────────────
//
// Each virtual namespace module maps a Vencord import path to CottonCord
// equivalents. These are returned verbatim as ESM source by the esbuild
// plugin below, so the plugin's TypeScript compiles cleanly and all Vencord
// API symbols resolve to our implementations at runtime.

const SHIM_MAP = {
  // @utils/types  ─── definePlugin, OptionType
  '@utils/types': `
    export default function definePlugin(p) { return p; }
    export const OptionType = window.__CCOptionType ?? {
      STRING:'string',NUMBER:'number',BOOLEAN:'boolean',
      SELECT:'select',SLIDER:'slider',COMPONENT:'component',CUSTOM:'custom'
    };
    export function openModal() {}
    export function closeModal() {}
    export function ModalRoot(p) { return null; }
    export function ModalHeader(p) { return null; }
    export function ModalContent(p) { return null; }
    export function ModalFooter(p) { return null; }
    export const ModalSize = { SMALL:'small',MEDIUM:'medium',LARGE:'large',DYNAMIC:'dynamic' };
  `,

  // @utils/constants  ─── Devs + platform flags
  '@utils/constants': `
    export const Devs = window.__CCDevs;
    export const VENCORD_USER_AGENT = 'CottonCord/1.0.0';
    export const IS_WINDOWS = typeof process !== 'undefined' && process.platform === 'win32';
    export const IS_MAC     = typeof process !== 'undefined' && process.platform === 'darwin';
    export const IS_LINUX   = typeof process !== 'undefined' && process.platform === 'linux';
    export const IS_DEV     = false;
    export const IS_WEB     = false;
    export const IS_DISCORD_DESKTOP = true;
  `,

  // @api/Commands
  '@api/Commands': `
    const api = window.CottonCordCommands ?? {};
    export const registerCommand   = api.registerCommand?.bind(api)   ?? (() => {});
    export const unregisterCommand = api.unregisterCommand?.bind(api) ?? (() => {});
    export const getCommand        = api.getCommand?.bind(api)        ?? (() => null);
    export const sendBotMessage    = api.sendBotMessage?.bind(api)    ?? (() => {});
    export const ApplicationCommandType       = { CHAT_INPUT:1, USER:2, MESSAGE:3 };
    export const ApplicationCommandInputType  = {
      BUILT_IN:0, BUILT_IN_TEXT:1, BUILT_IN_INTEGRATION:2, BOT:3, PLACEHOLDER:4
    };
    export const ApplicationCommandOptionType = {
      SUB_COMMAND:1, SUB_COMMAND_GROUP:2, STRING:3, INTEGER:4,
      BOOLEAN:5, USER:6, CHANNEL:7, ROLE:8, MENTIONABLE:9, NUMBER:10, ATTACHMENT:11
    };
    export function findOption(options, name, fallback) {
      return options?.find?.(o => o.name === name)?.value ?? fallback;
    }
    export function findGroupOption(options, groupName, name, fallback) {
      const grp = options?.find?.(o => o.name === groupName);
      return findOption(grp?.options, name, fallback);
    }
  `,

  // @api/MessageEvents
  '@api/MessageEvents': `
    const api = window.CottonCordMessageEvents ?? {};
    export const addPreSendListener    = api.addPreSendListener?.bind(api)    ?? (() => {});
    export const removePreSendListener = api.removePreSendListener?.bind(api) ?? (() => {});
    export const addPreEditListener    = api.addPreEditListener?.bind(api)    ?? (() => {});
    export const removePreEditListener = api.removePreEditListener?.bind(api) ?? (() => {});
  `,

  // @api/ContextMenu
  '@api/ContextMenu': `
    export function addContextMenuPatch(navId, patch) {}
    export function removeContextMenuPatch(navId, patch) {}
    export function addGlobalContextMenuPatch(patch) {}
    export function removeGlobalContextMenuPatch(patch) {}
    export function findGroupChildrenByChildId(id, children) { return null; }
  `,

  // @api/ChatButtons
  '@api/ChatButtons': `
    export function addChatBarButton(id, button) {}
    export function removeChatBarButton(id) {}
  `,

  // @api/MemberListDecorators
  '@api/MemberListDecorators': `
    export function addDecorator(id, decorator) {}
    export function removeDecorator(id) {}
  `,

  // @api/MessageDecorators
  '@api/MessageDecorators': `
    export function addDecorator(id, decorator) {}
    export function removeDecorator(id) {}
  `,

  // @api/MessagePopover
  '@api/MessagePopover': `
    export function addButton(id, label, predicate, action) {}
    export function removeButton(id) {}
  `,

  // @api/Notices
  '@api/Notices': `
    export function showNotice(content, type, buttons) {}
    export function popNotice() {}
  `,

  // @api/ServerList
  '@api/ServerList': `
    export function addServerListElement(type, render) {}
    export function removeServerListElement(type, render) {}
    export const ServerListRenderPosition = { Above:0, InBetween:1, Below:2 };
  `,

  // @api/Settings (plugin-level settings)
  '@api/Settings': `
    const api = window.CottonCordSettings ?? {};
    export function definePluginSettings(schema) {
      return api.definePluginSettings?.(schema) ?? { store: {}, schema };
    }
    export function migratePluginSettings(newName, oldName) {}
    export const OptionType = window.__CCOptionType ?? {};
    export const Settings   = new Proxy({}, {
      get(_, k) { return api.getSettings?.('_global')?.[k]; }
    });
  `,

  // @vencord/discord-types — TypeScript type-only imports, empty at runtime
  '@vencord/discord-types': `
    export default {};
  `,

  // @webpack
  '@webpack': `
    const wp = window.VencordWebpack ?? {};
    export const findByProps          = wp.findByProps?.bind(wp)          ?? (() => null);
    export const findByCode           = wp.findByCode?.bind(wp)           ?? (() => null);
    export const findComponentByCode  = wp.findComponentByCode?.bind(wp)  ?? (() => null);
    export const findStoreName        = wp.findStoreName?.bind(wp)        ?? (() => null);
    export const proxyLazyWebpack     = wp.proxyLazyWebpack?.bind(wp)    ?? ((f)=>f());
    export const waitForModule        = wp.waitForModule?.bind(wp)        ?? (() => Promise.resolve(null));
    export const findByPropsLazy      = (...props) => wp.proxyLazyWebpack?.(() => wp.findByProps?.(...props)) ?? null;
    export const findByCodeLazy       = (...code)  => wp.proxyLazyWebpack?.(() => wp.findByCode?.(...code))  ?? null;
    export const findComponentByCodeLazy = (...c)  => wp.proxyLazyWebpack?.(() => wp.findComponentByCode?.(...c)) ?? null;
    export const filters = {
      byProps:       (...p) => m => p.every(k => k in (m??{})),
      byCode:        (...s) => m => typeof m === 'function' && s.every(c => m.toString().includes(c)),
      byDisplayName: (n)    => m => m?.displayName === n || m?.default?.displayName === n,
    };
  `,

  // @webpack/common
  '@webpack/common': `
    const c = window.VencordWebpackCommon ?? {};
    export const React            = c.React;
    export const ReactDOM         = c.ReactDOM;
    export const UserStore        = c.UserStore;
    export const GuildStore       = c.GuildStore;
    export const ChannelStore     = c.ChannelStore;
    export const MessageStore     = c.MessageStore;
    export const SelectedChannelStore  = c.SelectedChannelStore;
    export const SelectedGuildStore    = c.SelectedGuildStore;
    export const PermissionStore  = c.PermissionStore;
    export const RelationshipStore= c.RelationshipStore;
    export const PresenceStore    = c.PresenceStore;
    export const ReadStateStore   = c.ReadStateStore;
    export const GuildMemberStore = c.GuildMemberStore;
    export const UserProfileStore = c.UserProfileStore;
    export const FluxDispatcher   = c.FluxDispatcher;
    export const NavigationUtils  = c.NavigationUtils;
    export const Clipboard        = c.Clipboard;
    export const Toasts           = c.Toasts;
    export const i18n             = c.i18n;
    export const moment           = c.moment;
    export const Button           = c.Button;
    export const Forms            = c.Forms;
    export const Text             = c.Text;
    export const Tooltip          = c.Tooltip;
    export const Menu             = c.Menu;
    export const Popout           = c.Popout;
    export const Parser           = c.Parser;
    export const MessageActions   = c.MessageActions;
    export const PermissionsBits  = c.PermissionsBits;
  `,
};

// Empty module — returned for any @utils/* or @api/* we haven't specifically shimmed.
const EMPTY_SHIM = `export default {}; export const __esModule = true;`;

// ── esbuild shim plugin factory ────────────────────────────────────────────

function makeShimPlugin() {
  return {
    name: 'cottoncord-vencord-shims',
    setup(build) {
      // Intercept every import that starts with @ and route to our namespace
      build.onResolve({ filter: /^@/ }, args => ({
        path:      args.path,
        namespace: 'cc-vencord-shim',
      }));

      build.onLoad({ filter: /.*/, namespace: 'cc-vencord-shim' }, args => {
        const contents = SHIM_MAP[args.path] ?? EMPTY_SHIM;
        return { contents: contents.trim(), loader: 'js' };
      });
    },
  };
}

// ── Bundle a plugin entry point to a single in-memory ESM string ───────────

async function bundlePlugin(entryPoint) {
  const esbuild = require('esbuild');

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle:      true,
    write:       false,
    format:      'esm',
    target:      'es2020',
    logLevel:    'silent',
    plugins:     [makeShimPlugin()],
    // Tell esbuild to treat missing node built-ins as external — they're
    // available via Node in the renderer's preload context.
    external:    ['fs', 'path', 'os', 'crypto', 'child_process', 'electron'],
  });

  if (!result.outputFiles?.length) throw new Error('esbuild produced no output');
  return result.outputFiles[0].text;
}

// ── Resolve entry point (file or folder) ──────────────────────────────────

function resolveEntry(pluginPath) {
  const stat = fs.statSync(pluginPath);
  if (stat.isDirectory()) {
    for (const name of ['index.ts', 'index.js']) {
      const p = path.join(pluginPath, name);
      if (fs.existsSync(p)) return p;
    }
    throw new Error(`No index.ts or index.js in ${pluginPath}`);
  }
  return pluginPath;
}

// ── Patch application ──────────────────────────────────────────────────────

function applyPatch(pluginName, patch) {
  if (!patch?.find) return;

  const replacements = Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement];
  if (!replacements.length) return;

  const target = window.ModuleStore?.findByString(patch.find);
  if (!target) {
    if (!patch.noWarn) {
      console.warn(`[CottonCord] Vencord patch: module not found for find="${patch.find}" (${pluginName})`);
    }
    return;
  }

  const keys = Object.keys(target);

  for (const { match, replace } of replacements) {
    if (!match && match !== '') continue;

    let applied = false;
    for (const key of keys) {
      const fn = target[key];
      if (typeof fn !== 'function') continue;

      let src;
      try { src = fn.toString(); } catch (_) { continue; }

      const pattern = match instanceof RegExp ? match : new RegExp(escapeRegex(String(match)), 'g');
      if (!pattern.test(src)) continue;
      pattern.lastIndex = 0;

      const patched = typeof replace === 'function'
        ? src.replace(pattern, replace)
        : src.replace(pattern, replace);

      if (patched === src) continue;

      try {
        // eslint-disable-next-line no-new-func
        const rebuilt = new Function(`return (${patched})`)();
        if (typeof rebuilt === 'function') {
          target[key] = rebuilt;
          applied = true;
        }
      } catch (err) {
        console.warn(`[CottonCord] Vencord patch rebuild failed (${pluginName}.${key}):`, err.message);
      }
    }

    if (!applied && !patch.noWarn) {
      console.warn(`[CottonCord] Vencord patch: match not found in "${patch.find}" (${pluginName})`);
    }
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPatches(plugin, pluginName) {
  if (!Array.isArray(plugin.patches) || !plugin.patches.length) return;
  for (const patch of plugin.patches) {
    try { applyPatch(pluginName, patch); }
    catch (err) { console.error(`[CottonCord] Vencord patch error (${pluginName}):`, err.message); }
  }
}

// ── Plugin lifecycle ───────────────────────────────────────────────────────

async function loadPlugin(pluginPath) {
  let pluginName;
  try {
    const stat = fs.statSync(pluginPath);
    pluginName = stat.isDirectory()
      ? path.basename(pluginPath)
      : path.basename(pluginPath, path.extname(pluginPath));

    const entry  = resolveEntry(pluginPath);

    // Tell definePluginSettings() which plugin is being loaded
    window.__CCCurrentPlugin = pluginName;

    const bundled = await bundlePlugin(entry);
    const encoded = encodeURIComponent(bundled);
    const mod     = await import(`data:text/javascript;charset=utf-8,${encoded}`);
    const plugin  = mod.default ?? mod;

    window.__CCCurrentPlugin = null;

    if (!plugin || typeof plugin !== 'object') {
      console.warn(`[CottonCord] Vencord plugin "${pluginName}" did not export a default object — skipping`);
      return;
    }

    const name        = plugin.name        ?? pluginName;
    const description = plugin.description ?? '';
    const tags        = plugin.tags        ?? [];
    const authors     = plugin.authors     ?? [];

    applyPatches(plugin, name);

    try { plugin.start?.(); }
    catch (startErr) {
      console.error(`[CottonCord] Vencord plugin start() failed (${name}):`, startErr.message);
    }

    pluginRegistry.set(name, { name, description, enabled: true, instance: plugin, tags, authors });
    console.log(`[CottonCord] ✅ Vencord plugin loaded: ${name}`);
  } catch (err) {
    if (pluginName) window.__CCCurrentPlugin = null;
    console.error(`[CottonCord] Failed to load Vencord plugin "${pluginName ?? pluginPath}":`, err.message);
  }
}

async function loadAllPlugins() {
  try {
    if (!fs.existsSync(PLUGINS_DIR)) {
      console.warn('[CottonCord] Vencord plugins directory not found:', PLUGINS_DIR);
      return;
    }

    const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
    const toLoad  = [];

    for (const entry of entries) {
      const fullPath = path.join(PLUGINS_DIR, entry.name);
      if (entry.isDirectory()) {
        // Only include folders that have an index file
        if (fs.existsSync(path.join(fullPath, 'index.ts')) ||
            fs.existsSync(path.join(fullPath, 'index.js'))) {
          toLoad.push(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        toLoad.push(fullPath);
      }
    }

    if (!toLoad.length) {
      console.log('[CottonCord] No Vencord plugins found.');
      return;
    }

    // Load in parallel — plugins are independent
    await Promise.all(toLoad.map(p => loadPlugin(p)));
    console.log(`[CottonCord] Vencord loader: ${pluginRegistry.size} plugin(s) loaded`);
  } catch (err) {
    console.error('[CottonCord] Vencord loader: fatal error during init:', err.message);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

function enablePlugin(name) {
  const entry = pluginRegistry.get(name);
  if (!entry) return;
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
  if (!entry) return;
  try { entry.instance.stop?.(); } catch (_) {}
  try { window.CottonCordPatcher?.unpatchAll(name); } catch (_) {}
  entry.enabled = false;
}

function reloadPlugin(name) { disablePlugin(name); enablePlugin(name); }
function getPlugins()       { return Array.from(pluginRegistry.values()); }
function getLoadedCount()   { return pluginRegistry.size; }

// ── Boot ───────────────────────────────────────────────────────────────────

loadAllPlugins().catch(err =>
  console.error('[CottonCord] Vencord loader: unhandled async error:', err.message)
);

window.VencordPluginLoader = {
  getPlugins, loadPlugin, enablePlugin, disablePlugin, reloadPlugin,
  getPluginCount: getLoadedCount,
};

module.exports = { getPlugins, loadPlugin, enablePlugin, disablePlugin, reloadPlugin, getLoadedCount };
