import { useState, useEffect } from 'react';

export default function Users({ user }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const r = await fetch('/api/users');
    if (r.ok) setUsers(await r.json());
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error); return; }
      setSuccess('Usuário criado! Compartilhe o e-mail e senha com a pessoa.');
      setForm({ name: '', email: '', password: '' });
      load();
    } catch { setError('Erro ao criar usuário'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este usuário?')) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div style={{ padding: '16px', maxWidth: 500, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
        👥 Usuários com Acesso
      </h2>
      <p style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
        Pessoas que podem ver sua agenda (mas não editar)
      </p>

      {/* Existing users */}
      {users.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {users.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 12, marginBottom: 8,
              background: 'rgba(30,16,53,0.8)', border: '1px solid rgba(109,40,217,0.2)',
            }}>
              <div>
                <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{u.name}</p>
                <p style={{ fontSize: 12, color: '#7c3aed' }}>{u.email}</p>
              </div>
              <button onClick={() => handleDelete(u.id)} style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', borderRadius: 8, padding: '6px 10px', fontSize: 16,
              }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* Add user form */}
      <div style={{
        background: 'rgba(30,16,53,0.8)', borderRadius: 16,
        border: '1px solid rgba(109,40,217,0.3)', padding: 20,
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd', marginBottom: 16 }}>
          ➕ Adicionar Usuário
        </p>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Nome', key: 'name', type: 'text', placeholder: 'Ex: João' },
            { label: 'E-mail', key: 'email', type: 'email', placeholder: 'email@exemplo.com' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 12, color: '#7c3aed', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
                placeholder={f.placeholder} required style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
                  background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.3)',
                  color: '#e2e8f0', outline: 'none',
                }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, color: '#7c3aed', display: 'block', marginBottom: 4 }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                placeholder="Mínimo 6 caracteres" required minLength={6} style={{
                  width: '100%', padding: '10px 40px 10px 12px', borderRadius: 8, fontSize: 14,
                  background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.3)',
                  color: '#e2e8f0', outline: 'none',
                }} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#7c3aed', fontSize: 16,
              }}>{showPw ? '🙈' : '👁️'}</button>
            </div>
          </div>

          {error && <p style={{ color: '#f87171', fontSize: 13 }}>❌ {error}</p>}
          {success && <p style={{ color: '#6ee7b7', fontSize: 13 }}>✅ {success}</p>}

          <button type="submit" disabled={loading} style={{
            padding: '12px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #6d28d9, #a855f7)',
            color: '#fff', fontSize: 15, fontWeight: 700,
          }}>
            {loading ? 'Criando...' : 'Criar Acesso'}
          </button>
        </form>
      </div>

      <div style={{
        marginTop: 16, padding: '12px 14px', borderRadius: 12,
        background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.15)',
      }}>
        <p style={{ fontSize: 12, color: '#7c3aed', lineHeight: 1.6 }}>
          💡 Usuários com acesso podem <strong style={{ color: '#a78bfa' }}>ver</strong> a agenda mas não podem editar.
          Após criar, envie o e-mail e senha para a pessoa.
        </p>
      </div>
    </div>
  );
}
