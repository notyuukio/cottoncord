'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Shared config path (same logic as vpnManager / backupTab) ─────────────

function getConfigPath() {
  let base;
  if (process.platform === 'win32')       base = process.env.APPDATA || '';
  else if (process.platform === 'darwin') base = path.join(os.homedir(), 'Library', 'Application Support');
  else                                    base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'CottonCord', 'cottoncord-config.json');
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')); } catch (_) { return {}; }
}

function writeConfig(data) {
  const p = getConfigPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  } catch (_) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. COMMANDS API  (@api/Commands)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const _commands = new Map(); // name → command definition
let _commandsPatched = false;

function _ensureCommandPatch() {
  if (_commandsPatched) return;
  _commandsPatched = true;

  // Discord exposes built-in slash commands through a module that has
  // getBuiltInCommands / BUILT_IN_COMMANDS. We patch its getter so our
  // registered commands always appear in the autocomplete list.
  try {
    const mod = window.ModuleStore?.findByProps('getBuiltInCommands')
             ?? window.ModuleStore?.findByString('BUILT_IN_COMMANDS');
    if (!mod) return;

    const methodName = Object.getOwnPropertyNames(mod).find(
      k => typeof mod[k] === 'function' && k.toLowerCase().includes('builtin')
    ) ?? 'getBuiltInCommands';

    window.CottonCordPatcher?.after(
      'CottonCord-Commands', mod, methodName,
      (_, __, result) => {
        if (!Array.isArray(result)) return;
        for (const cmd of _commands.values()) {
          if (!result.find(c => c.id === cmd.id || c.name === cmd.name)) {
            result.push(cmd);
          }
        }
      },
    );
  } catch (_) {}
}

function registerCommand(cmd) {
  if (!cmd?.name) return;
  const normalized = {
    id:          cmd.id          ?? `cc_${cmd.name}`,
    name:        cmd.name,
    description: cmd.description ?? '',
    inputType:   cmd.inputType   ?? 1,
    type:        cmd.type        ?? 1,
    options:     cmd.options     ?? [],
    execute(args, ctx) {
      try { cmd.execute?.(args, ctx); } catch (err) {
        console.error(`[CottonCord] Command "${cmd.name}" execute error:`, err.message);
      }
    },
  };
  _commands.set(cmd.name, normalized);
  _ensureCommandPatch();
}

function unregisterCommand(name) { _commands.delete(name); }
function getCommands()           { return Array.from(_commands.values()); }

// sendBotMessage — dispatches a synthetic MESSAGE_CREATE so the plugin can
// show ephemeral-style responses without needing server involvement.
function sendBotMessage(channelId, content) {
  try {
    const dispatcher = window.ModuleStore?.findByProps('dispatch', 'subscribe', 'wait');
    dispatcher?.dispatch({
      type: 'MESSAGE_CREATE',
      channelId,
      message: {
        id:         String(Date.now()),
        channel_id: channelId,
        content,
        author:    { id: 'cottoncord', username: 'CottonCord', bot: true, avatar: null },
        timestamp: new Date().toISOString(),
        type:      0,
        embeds:    [],
        attachments: [],
        mentions:  [],
      },
      optimistic: false,
      isPushNotification: false,
    });
  } catch (_) {}
}

window.CottonCordCommands = { registerCommand, unregisterCommand, getCommands, sendBotMessage };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. MESSAGE EVENTS API  (@api/MessageEvents)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const _preSendListeners   = new Set();
const _preEditListeners   = new Set();
const _receivedListeners  = new Set();
const _deleteListeners    = new Set();

let _sendPatched   = false;
let _editPatched   = false;
let _dispatchWired = false;

function _ensureSendPatch() {
  if (_sendPatched) return;
  _sendPatched = true;
  try {
    const mod = window.ModuleStore?.findByProps('sendMessage', 'sendGreetMessage');
    if (!mod) return;
    window.CottonCordPatcher?.before(
      'CottonCord-MessageEvents', mod, 'sendMessage',
      (_, [channelId, message, nonce, extra]) => {
        for (const cb of _preSendListeners) {
          try {
            const result = cb(channelId, message, extra ?? {});
            if (result === false) return [channelId, null, nonce, extra]; // cancel send
          } catch (_) {}
        }
      },
    );
  } catch (_) {}
}

function _ensureEditPatch() {
  if (_editPatched) return;
  _editPatched = true;
  try {
    const mod = window.ModuleStore?.findByProps('editMessage');
    if (!mod) return;
    window.CottonCordPatcher?.before(
      'CottonCord-MessageEvents', mod, 'editMessage',
      (_, [channelId, messageId, content]) => {
        for (const cb of _preEditListeners) {
          try { cb(channelId, messageId, content); } catch (_) {}
        }
      },
    );
  } catch (_) {}
}

function _ensureDispatchWired() {
  if (_dispatchWired) return;
  _dispatchWired = true;
  try {
    const dispatcher = window.ModuleStore?.findByProps('dispatch', 'subscribe', 'wait');
    if (!dispatcher?.subscribe) return;

    dispatcher.subscribe('MESSAGE_CREATE', ({ message, channelId }) => {
      for (const cb of _receivedListeners) {
        try { cb(message, channelId); } catch (_) {}
      }
    });

    dispatcher.subscribe('MESSAGE_DELETE', ({ id, channelId }) => {
      for (const cb of _deleteListeners) {
        try { cb(id, channelId); } catch (_) {}
      }
    });
  } catch (_) {}
}

function addPreSendListener(cb) {
  _preSendListeners.add(cb);
  _ensureSendPatch();
  return cb;
}
function removePreSendListener(cb) { _preSendListeners.delete(cb); }

function addPreEditListener(cb) {
  _preEditListeners.add(cb);
  _ensureEditPatch();
  return cb;
}
function removePreEditListener(cb) { _preEditListeners.delete(cb); }

function onMessageReceived(cb) {
  _receivedListeners.add(cb);
  _ensureDispatchWired();
  return cb;
}
function removeMessageReceivedListener(cb) { _receivedListeners.delete(cb); }

function onMessageDelete(cb) {
  _deleteListeners.add(cb);
  _ensureDispatchWired();
  return cb;
}
function removeMessageDeleteListener(cb) { _deleteListeners.delete(cb); }

window.CottonCordMessageEvents = {
  addPreSendListener, removePreSendListener,
  addPreEditListener, removePreEditListener,
  onMessageReceived,  removeMessageReceivedListener,
  onMessageDelete,    removeMessageDeleteListener,
  // Alias for plugins that import non-Pre versions
  onBeforeMessageSend: addPreSendListener,
  onBeforeMessageEdit: addPreEditListener,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. SETTINGS API  (definePluginSettings)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const OptionType = {
  STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean',
  SELECT: 'select', SLIDER: 'slider', COMPONENT: 'component', CUSTOM: 'custom',
};

function getSettings(pluginName) {
  return readConfig()?.plugins?.[pluginName] ?? {};
}

function setSettings(pluginName, key, value) {
  const cfg = readConfig();
  if (!cfg.plugins) cfg.plugins = {};
  if (!cfg.plugins[pluginName]) cfg.plugins[pluginName] = {};
  cfg.plugins[pluginName][key] = value;
  writeConfig(cfg);
}

function resetSettings(pluginName) {
  const cfg = readConfig();
  if (cfg.plugins?.[pluginName]) delete cfg.plugins[pluginName];
  writeConfig(cfg);
}

// Called at plugin module evaluation time (module-level const).
// Uses window.__CCCurrentPlugin so the loader can tell us which plugin is loading.
function definePluginSettings(schema) {
  // Capture the plugin name at the time definePluginSettings is called.
  // preload sets window.__CCCurrentPlugin before each plugin is imported.
  const pluginName = window.__CCCurrentPlugin || '_unknown_';

  const defaults = {};
  for (const [key, def] of Object.entries(schema ?? {})) {
    defaults[key] = def.default ?? null;
  }

  const store = new Proxy(Object.create(null), {
    get(_, key) {
      if (key === '__schema') return schema;
      const saved = readConfig()?.plugins?.[pluginName]?.[key];
      return saved !== undefined ? saved : defaults[key];
    },
    set(_, key, value) {
      setSettings(pluginName, key, value);
      return true;
    },
    has(_, key)  { return key in defaults; },
    ownKeys()    { return Object.keys(defaults); },
    getOwnPropertyDescriptor(_, key) {
      return key in defaults ? { enumerable: true, configurable: true } : undefined;
    },
  });

  return { store, schema, pluginName };
}

window.CottonCordSettings = { getSettings, setSettings, resetSettings, definePluginSettings, OptionType };

module.exports = {
  registerCommand, unregisterCommand, getCommands, sendBotMessage,
  addPreSendListener, removePreSendListener, addPreEditListener, removePreEditListener,
  getSettings, setSettings, resetSettings, definePluginSettings,
  OptionType,
};
