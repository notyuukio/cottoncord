const esbuild = require('esbuild');
const path = require('path');

const entries = [
  'src/injector/index.js',
  'src/injector/preload.js',
  'src/core/moduleStore.js',
  'src/core/patcher.js',
  'src/loaders/bdLoader.js',
  'src/loaders/vencordLoader.js',
  'src/updater/autoUpdater.js',
  'src/updater/pluginRegistry.js',
  'src/protection/vpnManager.js',
];

async function build() {
  try {
    await esbuild.build({
      entryPoints: entries,
      bundle: false,
      platform: 'node',
      target: 'node18',
      outdir: 'dist',
      outbase: 'src',
    });
    console.log('CottonCord build complete.');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
