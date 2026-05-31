'use strict';

// Webpack module store — intercepts Discord's internal module registry so
// plugins can look up any Discord internal by props, display name, or string.

const modules = new Map();

// ── 1. Poll for webpack chunk ──────────────────────────────────────────────
// Handles any webpackChunk* global, not just the hardcoded discord_app name,
// and falls back to __webpack_require__.c if the push-based approach fails.

function findWebpackChunk() {
  if (Array.isArray(window.webpackChunkdiscord_app)) return window.webpackChunkdiscord_app;
  for (const key of Object.keys(window)) {
    if (key.startsWith('webpackChunk') && Array.isArray(window[key])) return window[key];
  }
  return null;
}

function waitForWebpack() {
  return new Promise((resolve) => {
    const chunk = findWebpackChunk();
    if (chunk) { resolve(chunk); return; }
    const interval = setInterval(() => {
      const c = findWebpackChunk();
      if (c) { clearInterval(interval); resolve(c); return; }
      // Direct cache fallback: __webpack_require__ is set by Discord as a global
      if (window.__webpack_require__?.c) { clearInterval(interval); resolve(null); }
    }, 100);
  });
}

// ── 2. Capture modules from Discord's require cache ────────────────────────

function walkCache(cache) {
  for (const id in cache) {
    try {
      const mod = cache[id];
      if (!mod?.exports) continue;
      modules.set(id, mod.exports);
    } catch (_) {}
  }
}

function captureModules(webpackChunk) {
  return new Promise((resolve) => {
    // Path A: chunk is null — __webpack_require__ is already available
    if (!webpackChunk) {
      try { walkCache(window.__webpack_require__.c); } catch (_) {}
      resolve();
      return;
    }

    // Path B: push a fake chunk to receive Discord's require function
    webpackChunk.push([
      [Symbol('cottoncord')],
      {},
      (require) => {
        try { walkCache(require.c ?? {}); } catch (err) {
          console.error('[CottonCord] moduleStore: error walking require.c:', err.message);
          // Last resort: try global __webpack_require__
          try { if (window.__webpack_require__?.c) walkCache(window.__webpack_require__.c); } catch (_) {}
        }
        resolve();
      },
    ]);
  });
}

// ── 3. Filter helpers ──────────────────────────────────────────────────────

function find(filter) {
  for (const [, mod] of modules) {
    try {
      if (filter(mod)) return mod;
    } catch (_) {
      // filter threw — skip this module
    }
    // Also test mod.default (common for ES-module-wrapped exports)
    if (mod && mod.default) {
      try {
        if (filter(mod.default)) return mod.default;
      } catch (_) {}
    }
  }
  return null;
}

function findByProps(...props) {
  return find((mod) => {
    const target = mod && typeof mod === 'object' ? mod : null;
    if (target && props.every((p) => p in target)) return true;
    const def = target?.default;
    if (def && typeof def === 'object' && props.every((p) => p in def)) return true;
    return false;
  });
}

function findByDisplayName(name) {
  return find((mod) => {
    if (mod?.displayName === name) return true;
    if (mod?.default?.displayName === name) return true;
    return false;
  });
}

function findAll(filter) {
  const results = [];
  for (const [, mod] of modules) {
    try {
      if (filter(mod)) {
        results.push(mod);
        continue;
      }
    } catch (_) {}
    if (mod && mod.default) {
      try {
        if (filter(mod.default)) results.push(mod.default);
      } catch (_) {}
    }
  }
  return results;
}

function findByString(str) {
  for (const [, mod] of modules) {
    try {
      if (typeof mod === 'function' && mod.toString().includes(str)) return mod;
      if (mod && mod.default && typeof mod.default === 'function' && mod.default.toString().includes(str)) return mod.default;
    } catch (_) {}
    // Also scan object values one level deep
    if (mod && typeof mod === 'object') {
      for (const key of Object.keys(mod)) {
        try {
          const val = mod[key];
          if (typeof val === 'function' && val.toString().includes(str)) return mod;
        } catch (_) {}
      }
    }
  }
  return null;
}

// ── 4 & 5. Bootstrap and expose ───────────────────────────────────────────

(async () => {
  try {
    const webpackChunk = await waitForWebpack();
    await captureModules(webpackChunk);

    window.ModuleStore = {
      find,
      findByProps,
      findByDisplayName,
      findAll,
      findByString,
      get count() { return modules.size; },
    };

    console.log(`[CottonCord] moduleStore: captured ${modules.size} webpack modules`);

    // ── Self-test ────────────────────────────────────────────────────────
    const tests = [
      { label: 'findByProps("sendMessage")',    result: findByProps('sendMessage') },
      { label: 'findByProps("getCurrentUser")', result: findByProps('getCurrentUser') },
      { label: 'findByDisplayName("Message")',  result: findByDisplayName('Message') },
    ];

    for (const { label, result } of tests) {
      if (result) {
        console.log(`%c[CottonCord] ✅ ${label} → found`, 'color:#43b581');
      } else {
        console.warn(`[CottonCord] ⚠️  ${label} → NOT FOUND`);
      }
    }
  } catch (err) {
    console.error('[CottonCord] moduleStore: fatal error during init:', err);
  }
})();

module.exports = {
  find,
  findByProps,
  findByDisplayName,
  findAll,
  findByString,
  getModuleCount() { return modules.size; },
};
