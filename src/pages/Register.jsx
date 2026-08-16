import { useState, useEffect } from 'react';

export default function Register({ token, onLogin }) {
  const [info, setInfo] = useState(null);
  const [invalid, setInvalid] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`).then(async r => {
      const d = await r.json();
      if (!r.ok) { setInvalid(d.error || 'Convite inválido'); return; }
      setInfo(d); setName(d.name || '');
    }).catch(() => setInvalid('Não foi possível carregar o convite.'));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const r = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, email: email.trim().toLowerCase(), password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erro ao criar conta'); return; }
      onLogin(d.user);
    } catch { setError('Erro de conexão'); } finally { setLoading(false); }
  };

  const wrap = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0a1e 0%, #1e1035 50%, #0f0a1e 100%)', padding: 16,
  };
  const field = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.3)',
    color: '#e2e8f0', fontSize: 15, outline: 'none',
  };
  const lbl = { display: 'block', color: '#c4b5fd', fontSize: 13, marginBottom: 6 };

  if (invalid) return (
    <div style={wrap}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⛔</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>Convite indisponível</h1>
        <p style={{ color: '#a78bfa', fontSize: 14 }}>{invalid}</p>
        <p style={{ color: '#7c3aed', fontSize: 13, marginTop: 16 }}>Peça um novo link para quem te convidou.</p>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6d28d9, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 36, boxShadow: '0 0 30px rgba(109,40,217,0.5)',
          }}>📅</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>Criar sua conta</h1>
          {info && (
            <p style={{ color: '#a78bfa', fontSize: 14 }}>
              <strong style={{ color: '#c4b5fd' }}>{info.ownerName}</strong> convidou você para ver a agenda dela
            </p>
          )}
        </div>

        <div style={{
          background: 'rgba(30,16,53,0.9)', borderRadius: 20,
          border: '1px solid rgba(109,40,217,0.3)', padding: 28, backdropFilter: 'blur(10px)',
        }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={lbl}>Seu nome</label>
              <input value={name} onChange={e => setName(e.target.value)} required style={field} placeholder="Como quer ser chamado(a)" />
            </div>
            <div>
              <label style={lbl}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={field} placeholder="seu@email.com" />
            </div>
            <div>
              <label style={lbl}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6} style={{ ...field, paddingRight: 44 }} placeholder="Mínimo 6 caracteres" />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#a78bfa', fontSize: 18,
                }}>{showPw ? '🙈' : '👁️'}</button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 14,
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading || !info} style={{
              width: '100%', padding: 14, borderRadius: 10, border: 'none',
              background: loading ? '#4c1d95' : 'linear-gradient(135deg, #6d28d9, #a855f7)',
              color: '#fff', fontSize: 16, fontWeight: 700,
              boxShadow: '0 4px 15px rgba(109,40,217,0.4)',
            }}>{loading ? 'Criando...' : 'Criar conta e entrar 🚀'}</button>
          </form>
        </div>
        <p style={{ textAlign: 'center', color: '#4c1d95', fontSize: 12, marginTop: 20 }}>♥ Feito com amor</p>
      </div>
    </div>
  );
}
