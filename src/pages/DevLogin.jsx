import { useState } from 'react';

export default function DevLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const r = await fetch('/api/dev/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erro'); return; }
      onLogin(d.user);
    } catch { setError('Erro de conexão'); } finally { setLoading(false); }
  };

  const field = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)',
    color: '#e2e8f0', fontSize: 15, outline: 'none',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0b1120 0%,#111827 60%,#0b1120 100%)', padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg,#334155,#0ea5e9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 34,
          }}>🛠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>Painel do Desenvolvedor</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Acesso restrito</p>
        </div>

        <div style={{
          background: 'rgba(17,24,39,0.9)', borderRadius: 18,
          border: '1px solid rgba(148,163,184,0.2)', padding: 26,
        }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Usuário</label>
              <input value={username} onChange={e => setUsername(e.target.value)} required autoCapitalize="none"
                autoCorrect="off" spellCheck={false} placeholder="usuário" style={field} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••" style={{ ...field, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#64748b', fontSize: 18,
                }}>{showPw ? '🙈' : '👁️'}</button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 14,
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: 14, borderRadius: 10, border: 'none',
              background: loading ? '#1e293b' : 'linear-gradient(135deg,#0ea5e9,#6366f1)',
              color: '#fff', fontSize: 16, fontWeight: 700,
            }}>{loading ? 'Entrando...' : 'Entrar'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
