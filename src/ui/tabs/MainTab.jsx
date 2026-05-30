'use strict';

const React = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');

const LOGO_SVG = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="24" fill="#5865f2"/>
  <text x="24" y="32" text-anchor="middle" font-size="24" fill="#fff">🐰</text>
</svg>`;

export default function MainTab() {
  const version  = window.CottonCord?.version ?? '1.0.0';
  const bdPlugins  = window.BDPluginLoader?.getPlugins?.()      ?? [];
  const vcPlugins  = window.VencordPluginLoader?.getPlugins?.() ?? [];
  const vpnStatus  = window.CottonCordVPN?.getStatus?.();
  const lastCheck  = window.CottonCordUpdater?.getLastChecked?.();

  const connected  = vpnStatus?.connected ?? false;
  const provider   = vpnStatus?.provider   ?? '—';

  return (
    <div style={{ padding: '32px 40px', color: '#dbdee1', maxWidth: '680px' }}>
      {/* Logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#5865f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px',
        }}>🐰</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#f2f3f5' }}>
            CottonCord
          </h1>
          <span style={{ color: '#949ba4', fontSize: '14px' }}>v{version}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '28px' }}>
        <StatCard label="BD Plugins"      value={bdPlugins.length}  color="#f0b132" />
        <StatCard label="Vencord Plugins" value={vcPlugins.length}  color="#5865f2" />
        <StatCard
          label="IP Protection"
          value={connected ? 'Active' : 'Inactive'}
          color={connected ? '#23a55a' : '#ed4245'}
        />
      </div>

      {/* Details */}
      <Section title="Status">
        <Row label="BD plugins loaded"      value={`${bdPlugins.filter(p => p.enabled).length} / ${bdPlugins.length}`} />
        <Row label="Vencord plugins loaded"  value={`${vcPlugins.filter(p => p.enabled).length} / ${vcPlugins.length}`} />
        <Row label="VPN provider"            value={provider} />
        <Row label="Last update check"       value={lastCheck ? new Date(lastCheck).toLocaleString() : 'Not yet checked'} />
      </Section>

      {/* Links */}
      <Section title="Links">
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <LinkButton href="https://github.com/notyuukio/cottoncord">GitHub</LinkButton>
          <LinkButton href="https://github.com/notyuukio/cottoncord/issues">Report Issue</LinkButton>
        </div>
      </Section>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#2b2d31', border: '1px solid #1e1f22', borderRadius: '8px',
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#949ba4', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700,
                   textTransform: 'uppercase', letterSpacing: '0.06em', color: '#949ba4' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid #2b2d31', fontSize: '14px',
    }}>
      <span style={{ color: '#b5bac1' }}>{label}</span>
      <span style={{ color: '#f2f3f5', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function LinkButton({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-block', padding: '8px 14px', borderRadius: '4px',
        background: '#5865f2', color: '#fff', textDecoration: 'none',
        fontSize: '14px', fontWeight: 500,
      }}
    >
      {children}
    </a>
  );
}
