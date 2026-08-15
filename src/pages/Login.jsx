import { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, remember }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Erro ao entrar'); return; }
      onLogin(data.user);
    } catch { setError('Erro de conexão'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0a1e 0%, #1e1035 50%, #0f0a1e 100%)',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6d28d9, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 36,
            boxShadow: '0 0 30px rgba(109,40,217,0.5)',
          }}>📅</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>
            Agenda Nayara
          </h1>
          <p style={{ color: '#a78bfa', fontSize: 14 }}>Sua escala de trabalho</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(30,16,53,0.9)', borderRadius: 20,
          border: '1px solid rgba(109,40,217,0.3)', padding: 28,
          backdropFilter: 'blur(10px)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: '#c4b5fd', fontSize: 13, marginBottom: 6 }}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading}
                placeholder="seu@email.com"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.3)',
                  color: '#e2e8f0', fontSize: 15, outline: 'none',
                }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#c4b5fd', fontSize: 13, marginBottom: 6 }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required disabled={loading} placeholder="••••••••"
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10,
                    background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.3)',
                    color: '#e2e8f0', fontSize: 15, outline: 'none',
                  }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#a78bfa', fontSize: 18,
                  }}>{showPw ? '🙈' : '👁️'}</button>
              </div>
            </div>

            {/* Manter-me conectado */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <span onClick={() => setRemember(v => !v)} style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0, position: 'relative',
                background: remember ? '#6d28d9' : '#374151', transition: 'background 0.2s',
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, left: remember ? 23 : 3, transition: 'left 0.2s',
                }}/>
              </span>
              <span style={{ color: '#c4b5fd', fontSize: 13 }}>
                Manter-me conectado
                <span style={{ display: 'block', color: '#7c3aed', fontSize: 11 }}>
                  Sem isso, o app pede login todo dia
                </span>
              </span>
            </label>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 14,
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading || !email || !password}
              style={{
                width: '100%', padding: 14, borderRadius: 10, border: 'none',
                background: loading ? '#4c1d95' : 'linear-gradient(135deg, #6d28d9, #a855f7)',
                color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 15px rgba(109,40,217,0.4)',
                transition: 'opacity 0.2s',
              }}>
              {loading ? 'Entrando...' : 'Entrar 🚀'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#4c1d95', fontSize: 12, marginTop: 24 }}>
          ♥ Feito com amor
        </p>
      </div>
    </div>
  );
}
