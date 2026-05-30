'use strict';

// Webpack module store — intercepts Discord's internal module registry so
// plugins can look up any Discord internal by props, display name, or string.

const modules = new Map();

// ── 1. Poll for webpackChunkdiscord_app ────────────────────────────────────

function waitForWebpack() {
  return new Promise((resolve) => {
    if (window.webpackChunkdiscord_app) {
      resolve(window.webpackChunkdiscord_app);
      return;
    }
    const interval = setInterval(() => {
      if (window.webpackChunkdiscord_app) {
        clearInterval(interval);
        resolve(window.webpackChunkdiscord_app);
      }
    }, 100);
  });
}

// ── 2. Push a fake chunk to capture Discord's require and walk require.c ───

function captureModules(webpackChunk) {
  return new Promise((resolve) => {
    webpackChunk.push([
      [Symbol('cottoncord')],
      {},
      (require) => {
        try {
          const moduleCache = require.c ?? {};
          for (const id in moduleCache) {
            const mod = moduleCache[id];
            if (!mod?.exports) continue;
            modules.set(id, mod.exports);

            // Also index sub-keys for modules that export a namespace object
            if (typeof mod.exports === 'object') {
              for (const key of Object.keys(mod.exports)) {
                try {
                  const sub = mod.exports[key];
                  if (sub && typeof sub === 'object' && !modules.has(`${id}:${key}`)) {
                    // We don't store these separately — filters already check .default
                  }
                } catch (_) {
                  // ignore non-enumerable getters that throw
                }
              }
            }
          }
        } catch (err) {
          console.error('[CottonCord] moduleStore: error walking require.c:', err.message);
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
