'use strict';

const fs   = require('fs');
const path = require('path');
const React = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');

function getConfigPath() {
  let base;
  if (process.platform === 'win32')       base = process.env.APPDATA || '';
  else if (process.platform === 'darwin') base = path.join(process.env.HOME || '', 'Library', 'Application Support');
  else                                    base = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '', '.config');
  return path.join(base, 'CottonCord', 'cottoncord-config.json');
}

function buildBackup() {
  const config = (() => { try { return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')); } catch (_) { return {}; } })();
  const bd  = window.BDPluginLoader?.getPlugins?.()      ?? [];
  const vc  = window.VencordPluginLoader?.getPlugins?.() ?? [];
  return {
    version:      window.CottonCord?.version ?? '1.0.0',
    exportedAt:   new Date().toISOString(),
    config,
    enabledBD:    bd.filter(p => p.enabled).map(p => p.name),
    enabledVC:    vc.filter(p => p.enabled).map(p => p.name),
  };
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function BackupTab() {
  const [status, setStatus] = React.useState('');

  function handleExport() {
    try {
      downloadJson(buildBackup(), `cottoncord-backup-${Date.now()}.json`);
      setStatus('✓ Backup exported');
    } catch (err) {
      setStatus(`Export failed: ${err.message}`);
    }
    setTimeout(() => setStatus(''), 3500);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.config) {
            fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true });
            fs.writeFileSync(getConfigPath(), JSON.stringify(data.config, null, 2));
          }
          if (Array.isArray(data.enabledBD)) {
            const bd = window.BDPluginLoader?.getPlugins?.() ?? [];
            bd.forEach(p => {
              data.enabledBD.includes(p.name)
                ? window.BDPluginLoader?.enablePlugin?.(p.name)
                : window.BDPluginLoader?.disablePlugin?.(p.name);
            });
          }
          if (Array.isArray(data.enabledVC)) {
            const vc = window.VencordPluginLoader?.getPlugins?.() ?? [];
            vc.forEach(p => {
              data.enabledVC.includes(p.name)
                ? window.VencordPluginLoader?.enablePlugin?.(p.name)
                : window.VencordPluginLoader?.disablePlugin?.(p.name);
            });
          }
          setStatus('✓ Backup imported — restart Discord to apply all changes');
        } catch (err) {
          setStatus(`Import failed: ${err.message}`);
        }
        setTimeout(() => setStatus(''), 5000);
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleReset() {
    if (!confirm('Reset all CottonCord settings to defaults? This cannot be undone.')) return;
    try {
      fs.unlinkSync(getConfigPath());
      setStatus('✓ Settings reset — restart Discord to apply');
    } catch (_) {
      setStatus('Nothing to reset.');
    }
    setTimeout(() => setStatus(''), 3500);
  }

  return (
    <div style={{ padding: '32px 40px', color: '#dbdee1', maxWidth: '560px' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: '#f2f3f5' }}>
        Backup &amp; Restore
      </h2>
      <p style={{ margin: '0 0 28px', color: '#949ba4', fontSize: '14px' }}>
        Export your plugin state and config to a JSON file, or restore from a previous backup.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <ActionCard
          title="Export Backup"
          desc="Save plugin enable/disable state and VPN config to a .json file."
          buttonLabel="Export"
          buttonColor="#5865f2"
          onClick={handleExport}
        />
        <ActionCard
          title="Import Backup"
          desc="Restore settings from a previously exported CottonCord backup file."
          buttonLabel="Import"
          buttonColor="#5865f2"
          onClick={handleImport}
        />
        <ActionCard
          title="Reset to Defaults"
          desc="Delete all CottonCord configuration and return to factory defaults."
          buttonLabel="Reset"
          buttonColor="#ed4245"
          onClick={handleReset}
        />
      </div>

      {status && (
        <div style={{
          marginTop: '16px', padding: '10px 14px', borderRadius: '6px',
          background: '#2b2d31', border: '1px solid #3d3f45',
          color: '#dbdee1', fontSize: '14px',
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

function ActionCard({ title, desc, buttonLabel, buttonColor, onClick }) {
  return (
    <div style={{
      background: '#2b2d31', border: '1px solid #1e1f22', borderRadius: '8px',
      padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
    }}>
      <div>
        <div style={{ fontWeight: 600, color: '#f2f3f5', fontSize: '14px', marginBottom: '4px' }}>{title}</div>
        <div style={{ color: '#949ba4', fontSize: '13px' }}>{desc}</div>
      </div>
      <button
        onClick={onClick}
        style={{
          padding: '8px 16px', borderRadius: '4px', border: 'none',
          background: buttonColor, color: '#fff', cursor: 'pointer',
          fontSize: '14px', fontWeight: 500, flexShrink: 0,
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
