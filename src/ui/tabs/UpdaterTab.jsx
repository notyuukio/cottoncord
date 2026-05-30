'use strict';

const React = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');

export default function UpdaterTab() {
  const [checking, setChecking] = React.useState(false);
  const [done,     setDone]     = React.useState(false);

  const version    = window.CottonCordUpdater?.getCurrentVersion?.() ?? '1.0.0';
  const lastCheck  = window.CottonCordUpdater?.getLastChecked?.();
  const registry   = window.PluginRegistry?.getRegistry?.();
  const plugins    = registry?.plugins ?? [];

  async function handleCheck() {
    setChecking(true);
    setDone(false);
    try { await window.CottonCordUpdater?.checkForUpdates?.(); }
    catch (_) {}
    setChecking(false);
    setDone(true);
    setTimeout(() => setDone(false), 4000);
  }

  return (
    <div style={{ padding: '32px 40px', color: '#dbdee1', maxWidth: '680px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#f2f3f5' }}>Updater</h2>

      {/* Version info */}
      <InfoBlock>
        <Row label="Current version" value={`v${version}`} />
        <Row
          label="Last checked"
          value={lastCheck ? new Date(lastCheck).toLocaleString() : 'Not checked this session'}
        />
      </InfoBlock>

      <button
        onClick={handleCheck}
        disabled={checking}
        style={{
          padding: '9px 20px', borderRadius: '4px', border: 'none',
          background: done ? '#23a55a' : '#5865f2',
          color: '#fff', cursor: checking ? 'not-allowed' : 'pointer',
          fontSize: '14px', fontWeight: 500, marginBottom: '28px',
          opacity: checking ? 0.7 : 1, transition: 'background 0.2s',
        }}
      >
        {checking ? 'Checking…' : done ? '✓ Up to date' : 'Check Now'}
      </button>

      {/* Plugin registry status */}
      <h3 style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700,
                   textTransform: 'uppercase', letterSpacing: '0.06em', color: '#949ba4' }}>
        Plugin Registry
      </h3>
      <Row label="Registry last updated" value={window.PluginRegistry?.getLastUpdated?.() ?? '—'} />
      <Row label="Registered plugins"    value={plugins.length} />
      <Row label="Broken plugins"        value={plugins.filter(p => p.broken).length} />
    </div>
  );
}

function InfoBlock({ children }) {
  return (
    <div style={{
      background: '#2b2d31', border: '1px solid #1e1f22', borderRadius: '8px',
      padding: '4px 16px', marginBottom: '16px',
    }}>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '10px 0',
      borderBottom: '1px solid #1e1f22', fontSize: '14px',
    }}>
      <span style={{ color: '#b5bac1' }}>{label}</span>
      <span style={{ color: '#f2f3f5', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
