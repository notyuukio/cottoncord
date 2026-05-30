'use strict';

// ── Patch storage ──────────────────────────────────────────────────────────
//
// methodState: WeakMap<target, Map<methodName, MethodState>>
//   MethodState: { original: Function, patches: PatchEntry[] }
//
// A single dispatcher function lives on the target for each patched method.
// The dispatcher walks the patch list at call-time, so patches can be added
// or removed in any order without breaking each other's chains.
//
// patchesByCallerName: Map<callerName, PatchEntry[]>
//   Used by unpatchAll() to find and remove every patch a caller registered.

const methodState = new WeakMap();
const patchesByCallerName = new Map();
let patchIdCounter = 0;

// ── Internal helpers ───────────────────────────────────────────────────────

function getMethodState(target, methodName) {
  if (!methodState.has(target)) methodState.set(target, new Map());
  const methods = methodState.get(target);
  if (!methods.has(methodName)) {
    methods.set(methodName, { original: target[methodName], patches: [] });
  }
  return methods.get(methodName);
}

function installDispatcher(target, methodName, state) {
  target[methodName] = function (...args) {
    const ctx = this;

    // ── before ──────────────────────────────────────────────────────────
    for (const patch of state.patches) {
      if (patch.type !== 'before') continue;
      try {
        patch.callback(ctx, args);
      } catch (err) {
        console.error(
          `[CottonCord] Patcher before error [${patch.callerName} → ${methodName}]:`,
          err.message
        );
      }
    }

    // ── instead (last registered wins) ──────────────────────────────────
    let returnValue;
    let insteadPatch = null;
    for (let i = state.patches.length - 1; i >= 0; i--) {
      if (state.patches[i].type === 'instead') { insteadPatch = state.patches[i]; break; }
    }

    if (insteadPatch) {
      try {
        returnValue = insteadPatch.callback(ctx, args, state.original.bind(ctx));
      } catch (err) {
        console.error(
          `[CottonCord] Patcher instead error [${insteadPatch.callerName} → ${methodName}]:`,
          err.message
        );
        returnValue = state.original.apply(ctx, args);
      }
    } else {
      returnValue = state.original.apply(ctx, args);
    }

    // ── after ────────────────────────────────────────────────────────────
    for (const patch of state.patches) {
      if (patch.type !== 'after') continue;
      try {
        const result = patch.callback(ctx, args, returnValue);
        if (result !== undefined) returnValue = result;
      } catch (err) {
        console.error(
          `[CottonCord] Patcher after error [${patch.callerName} → ${methodName}]:`,
          err.message
        );
      }
    }

    return returnValue;
  };

  // Preserve the method name so stack traces stay readable
  try { Object.defineProperty(target[methodName], 'name', { value: methodName, configurable: true }); } catch (_) {}
}

function removePatch(patch) {
  const methods = methodState.get(patch.target);
  if (!methods) return;
  const state = methods.get(patch.methodName);
  if (!state) return;

  const idx = state.patches.indexOf(patch);
  if (idx !== -1) state.patches.splice(idx, 1);

  // No more patches on this method — restore the original
  if (state.patches.length === 0) {
    patch.target[patch.methodName] = state.original;
    methods.delete(patch.methodName);
  }
}

function registerPatch(callerName, target, methodName, type, callback) {
  if (typeof target?.[methodName] !== 'function') {
    console.error(`[CottonCord] Patcher: "${methodName}" is not a function on the target`);
    return () => {};
  }

  const state = getMethodState(target, methodName);
  const patch = { id: patchIdCounter++, callerName, target, methodName, type, callback };

  state.patches.push(patch);
  installDispatcher(target, methodName, state);

  if (!patchesByCallerName.has(callerName)) patchesByCallerName.set(callerName, []);
  patchesByCallerName.get(callerName).push(patch);

  return () => removePatch(patch);
}

// ── Public API ─────────────────────────────────────────────────────────────

function before(callerName, target, methodName, callback) {
  return registerPatch(callerName, target, methodName, 'before', callback);
}

function after(callerName, target, methodName, callback) {
  return registerPatch(callerName, target, methodName, 'after', callback);
}

function instead(callerName, target, methodName, callback) {
  return registerPatch(callerName, target, methodName, 'instead', callback);
}

function unpatchAll(callerName) {
  const patches = patchesByCallerName.get(callerName);
  if (!patches || patches.length === 0) return;

  // Iterate a copy — removePatch mutates the state.patches array
  for (const patch of [...patches]) {
    removePatch(patch);
  }
  patchesByCallerName.delete(callerName);
}

function getAllPatches() {
  // Return a plain object snapshot for DevTools inspection
  const result = {};
  for (const [callerName, patches] of patchesByCallerName) {
    result[callerName] = patches.map(({ id, methodName, type }) => ({ id, methodName, type }));
  }
  return result;
}

// ── Expose on window for plugin use ───────────────────────────────────────

window.CottonCordPatcher = { before, after, instead, unpatchAll, getAllPatches };

module.exports = { before, after, instead, unpatchAll, getAllPatches };
