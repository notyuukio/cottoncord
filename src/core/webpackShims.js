'use strict';

// Vencord's @webpack and @webpack/common module shims.
// Maps Vencord's webpack helper functions to CottonCord's ModuleStore,
// and lazily resolves common Discord stores/modules from the module cache.

// ── @webpack helpers ───────────────────────────────────────────────────────

function findByProps(...props) {
  return window.ModuleStore?.findByProps(...props) ?? null;
}

function findByCode(...strings) {
  for (const s of strings) {
    const m = window.ModuleStore?.findByString(s);
    if (m) return m;
  }
  return null;
}

// alias
const findComponentByCode = findByCode;

function findStoreName(name) {
  try {
    const all = window.ModuleStore?.findAll?.(m => typeof m?.getName === 'function' && m.getName() === name);
    return all?.[0] ?? null;
  } catch (_) { return null; }
}

// Returns a Proxy that defers module lookup to first property access.
// This lets plugins declare webpack dependencies at module scope without
// failing if the module store isn't fully populated yet.
function proxyLazyWebpack(factory) {
  let _resolved;
  const _resolve = () => {
    if (!_resolved) { try { _resolved = factory() ?? {}; } catch (_) { _resolved = {}; } }
    return _resolved;
  };
  return new Proxy(Object.create(null), {
    get(_, k)         { return _resolve()[k]; },
    has(_, k)         { return k in _resolve(); },
    ownKeys()         { return Reflect.ownKeys(_resolve()); },
    apply(_, t, args) { return _resolve().apply(t, args); },
    getOwnPropertyDescriptor(_, k) {
      return Object.getOwnPropertyDescriptor(_resolve(), k);
    },
  });
}

// Resolves when a matching module appears in the store (polls every 250ms).
function waitForModule(filterOrProps, timeoutMs = 15000) {
  const filter = typeof filterOrProps === 'function'
    ? filterOrProps
    : m => Array.isArray(filterOrProps) && filterOrProps.every(p => m && p in m);

  return new Promise((resolve, reject) => {
    const found = window.ModuleStore?.find?.(filter);
    if (found) { resolve(found); return; }

    const deadline = Date.now() + timeoutMs;
    const t = setInterval(() => {
      const m = window.ModuleStore?.find?.(filter);
      if (m) { clearInterval(t); resolve(m); return; }
      if (Date.now() > deadline) { clearInterval(t); reject(new Error('waitForModule: timed out')); }
    }, 250);
  });
}

// ── @webpack/common — lazily resolved Discord store references ─────────────
// Each getter calls findByProps at access time; the Proxy is exported as a
// single object so plugins can destructure: { React, UserStore } = common.

const _common = new Proxy(Object.create(null), {
  get(_, key) {
    const s = window.ModuleStore;
    if (!s) return undefined;
    switch (key) {
      // Core React
      case 'React':    return s.findByProps('createElement', 'useState');
      case 'ReactDOM': return s.findByProps('createRoot') || s.findByProps('render', 'unmountComponentAtNode');

      // Flux stores
      case 'UserStore':            return s.findByProps('getCurrentUser', 'getUser');
      case 'GuildStore':           return s.findByProps('getGuild', 'getGuilds');
      case 'ChannelStore':         return s.findByProps('getChannel', 'getDMFromUserId');
      case 'MessageStore':         return s.findByProps('getMessage', 'getMessages');
      case 'SelectedChannelStore': return s.findByProps('getChannelId', 'getVoiceChannelId');
      case 'SelectedGuildStore':   return s.findByProps('getGuildId', 'getLastSelectedGuildId');
      case 'PermissionStore':      return s.findByProps('getGuildPermissions', 'can');
      case 'RelationshipStore':    return s.findByProps('getRelationshipType', 'getFriendIDs');
      case 'PresenceStore':        return s.findByProps('getStatus', 'getActivities');
      case 'ReadStateStore':       return s.findByProps('getUnreadCount', 'hasUnread');
      case 'NotificationSettingsStore': return s.findByProps('getChannelMessageNotifications');
      case 'GuildMemberStore':     return s.findByProps('getMember', 'getMembers');
      case 'UserProfileStore':     return s.findByProps('getUserProfile', 'fetchProfile');

      // Utilities
      case 'FluxDispatcher':  return s.findByProps('dispatch', 'subscribe', 'wait');
      case 'NavigationUtils': return s.findByProps('transitionTo', 'replaceWith', 'transitionToGuild');
      case 'Clipboard':       return s.findByProps('SUPPORTS_COPY', 'copy');
      case 'Toasts':          return s.findByProps('show', 'pop');
      case 'i18n':            return s.findByProps('Messages', 'getLocale');
      case 'moment':          return s.findByProps('isMoment', 'utc');

      // UI components
      case 'Button':          return s.findByProps('Looks', 'Colors', 'Sizes')?.Button ?? s.findByProps('Button')?.Button;
      case 'Forms':           return s.findByProps('FormTitle', 'FormSection');
      case 'Text':            return s.findByProps('Text')?.Text ?? s.findByString('defaultMarginh2')?.Text;
      case 'Tooltip':         return s.findByDisplayName?.('Tooltip') ?? s.findByProps('Tooltip')?.Tooltip;
      case 'Menu':            return s.findByProps('MenuGroup', 'MenuItem');
      case 'Popout':          return s.findByDisplayName?.('Popout');

      // Markdown
      case 'Parser':          return s.findByProps('parse', 'parseTopic');
      case 'Timestamp':       return s.findByProps('Timestamp')?.Timestamp;

      // Message utilities
      case 'MessageActions':  return s.findByProps('sendMessage', 'receiveMessage');
      case 'PermissionsBits': return s.findByProps('ADMINISTRATOR', 'MANAGE_GUILD');

      default: return undefined;
    }
  },
  has(_, key)  { return true; },
  ownKeys()    { return []; },
});

window.VencordWebpack       = { findByProps, findByCode, findComponentByCode, findStoreName, proxyLazyWebpack, waitForModule };
window.VencordWebpackCommon = _common;

module.exports = { findByProps, findByCode, findComponentByCode, findStoreName, proxyLazyWebpack, waitForModule, common: _common };
