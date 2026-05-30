'use strict';

const React = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');

const PROVIDERS = [
  { value: 'protonvpn', label: 'ProtonVPN',  host: '127.0.0.1', port: 1080 },
  { value: 'mullvad',   label: 'Mullvad',    host: '10.8.0.1',  port: 1080 },
  { value: 'custom',    label: 'Custom',     host: '',           port: 1080 },
];

export default function ProtectionTab() {
  const [status,     setStatus]     = React.useState(() => window.CottonCordVPN?.getStatus?.() ?? {});
  const [provider,   setProvider]   = React.useState(status.provider ?? 'protonvpn');
  const [host,       setHost]       = React.useState('');
  const [port,       setPort]       = React.useState('1080');
  const [username,   setUsername]   = React.useState('');
  const [password,   setPassword]   = React.useState('');
  const [busy,       setBusy]       = React.useState(false);
  const [errorMsg,   setErrorMsg]   = React.useState('');

  const connected = status.connected ?? false;

  function refreshStatus() {
    setStatus(window.CottonCordVPN?.getStatus?.() ?? {});
  }

  function applyPreset(val) {
    setProvider(val);
    const preset = PROVIDERS.find(p => p.value === val);
    if (preset && val !== 'custom') {
      setHost(preset.host);
      setPort(String(preset.port));
    }
    setErrorMsg('');
  }

  async function handleConnect() {
    setBusy(true); setErrorMsg('');
    try {
      window.CottonCordVPN?.configure?.(provider, host, parseInt(port, 10) || 1080, username, password);
      await window.CottonCordVPN?.connect?.();
      refreshStatus();
    } catch (err) {
      setErrorMsg(err.message);
    } finally { setBusy(false); }
  }

  async function handleDisconnect() {
    setBusy(true); setErrorMsg('');
    try {
      await window.CottonCordVPN?.disconnect?.();
      refreshStatus();
    } catch (err) {
      setErrorMsg(err.message);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: '32px 40px', color: '#dbdee1', maxWidth: '560px' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: '#f2f3f5' }}>
        IP Protection
      </h2>
      <p style={{ margin: '0 0 24px', color: '#949ba4', fontSize: '14px' }}>
        Routes Discord traffic through a SOCKS5 proxy. All other apps go direct.
      </p>

      {/* Status indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '14px 16px', borderRadius: '8px',
        background: connected ? '#1a3a2a' : '#2b1f1f',
        border: `1px solid ${connected ? '#23a55a' : '#ed4245'}`,
        marginBottom: '24px',
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: connected ? '#23a55a' : '#ed4245',
          boxShadow: `0 0 6px ${connected ? '#23a55a' : '#ed4245'}`,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: '#f2f3f5', fontSize: '14px' }}>
            {connected ? `Protected via ${status.provider ?? provider}` : 'Unprotected'}
          </div>
          {!connected && status.realIP && (
            <div style={{ fontSize: '12px', color: '#949ba4', marginTop: '2px' }}>
              Real IP: {status.realIP}
            </div>
          )}
          {connected && status.maskedIP && (
            <div style={{ fontSize: '12px', color: '#949ba4', marginTop: '2px' }}>
              Masked IP: {status.maskedIP}
            </div>
          )}
        </div>
      </div>

      {/* Config form (only shown when disconnected) */}
      {!connected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <Field label="Provider">
            <select
              value={provider}
              onChange={e => applyPreset(e.target.value)}
              style={inputStyle}
            >
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Field label="Host" style={{ flex: 1 }}>
              <input value={host} onChange={e => setHost(e.target.value)}
                     placeholder="127.0.0.1" style={inputStyle} />
            </Field>
            <Field label="Port" style={{ width: '90px' }}>
              <input value={port} onChange={e => setPort(e.target.value)}
                     placeholder="1080" style={inputStyle} />
            </Field>
          </div>

          <Field label="Username (optional)">
            <input value={username} onChange={e => setUsername(e.target.value)}
                   placeholder="Leave blank if not required" style={inputStyle} />
          </Field>

          <Field label="Password">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                   placeholder="••••••••" style={inputStyle} />
          </Field>
        </div>
      )}

      {errorMsg && (
        <div style={{
          padding: '10px 14px', borderRadius: '6px', marginBottom: '14px',
          background: '#3a1f1f', border: '1px solid #ed4245',
          color: '#ed4245', fontSize: '13px',
        }}>
          {errorMsg}
        </div>
      )}

      <button
        onClick={connected ? handleDisconnect : handleConnect}
        disabled={busy}
        style={{
          padding: '10px 24px', borderRadius: '4px', border: 'none',
          background: connected ? '#ed4245' : '#23a55a',
          color: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
          fontSize: '14px', fontWeight: 600,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? '…' : connected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: '4px',
  border: '1px solid #3d3f45', background: '#1e1f22',
  color: '#dbdee1', fontSize: '14px', outline: 'none',
  boxSizing: 'border-box',
};

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600,
                      color: '#949ba4', marginBottom: '5px', textTransform: 'uppercase',
                      letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
