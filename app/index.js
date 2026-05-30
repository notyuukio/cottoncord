'use strict';

// This file lives at: Discord/resources/app/index.js
// The installer copies CottonCord's src/ directory to: Discord/resources/app/src/
// so all relative requires resolve correctly.

const path = require('path');

try {
  require(path.join(__dirname, 'src', 'injector', 'index.js'));
} catch (err) {
  console.error('[CottonCord] Failed to initialize injector:', err);
  // Hard fallback: load Discord directly so the user isn't locked out
  try {
    require(path.join(process.resourcesPath, 'app.asar'));
  } catch (fallbackErr) {
    console.error('[CottonCord] FATAL: Could not load Discord at all:', fallbackErr);
  }
}
