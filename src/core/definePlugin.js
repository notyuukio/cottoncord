'use strict';

// Vencord's definePlugin() is a no-op identity function — the plugin object
// is what the loader reads. We provide this as a global shim so any plugin
// that imports from @utils/types resolves without errors.
function definePlugin(plugin) {
  return plugin;
}

// OptionType enum — mirrors Vencord's so Settings schemas type-check.
const OptionType = {
  STRING:    'string',
  NUMBER:    'number',
  BOOLEAN:   'boolean',
  SELECT:    'select',
  SLIDER:    'slider',
  COMPONENT: 'component',
  CUSTOM:    'custom',
};

// Devs Proxy — any property access returns a sensible author stub so plugins
// that destructure specific contributor names still work.
const Devs = new Proxy(Object.create(null), {
  get(_, name) {
    return { name: String(name), id: 0n };
  },
});

// Expose as globals accessed by the esbuild shim modules at eval time.
window.__CCDefinePlugin = definePlugin;
window.__CCOptionType   = OptionType;
window.__CCDevs         = Devs;

module.exports = { definePlugin, OptionType, Devs };
