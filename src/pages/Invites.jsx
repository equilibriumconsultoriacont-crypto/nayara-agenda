import { useState, useEffect } from 'react';

export default function Invites() {
  const [invites, setInvites] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const load = async () => {
    const [ri, rv] = await Promise.all([fetch('/api/invites'), fetch('/api/users')]);
    if (ri.ok) setInvites(await ri.json());
    if (rv.ok) setViewers(await rv.json());
  };
  useEffect(() => { load(); }, []);

  const linkFor = (token) => `${window.location.origin}/convite/${token}`;

  const create = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const r = await fetch('/api/invites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erro'); return; }
      setName('');
      await load();
      share(d.token, name); // já tenta compartilhar/copiar o link novo
    } finally { setLoading(false); }
  };

  const share = async (token, who) => {
    const url = linkFor(token);
    const text = `Oi${who ? ' ' + who : ''}! Entra na minha agenda por aqui: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Agenda', text, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); setCopied(token); setTimeout(() => setCopied(null), 2000); } catch {}
  };

  const remove = async (id) => {
    if (!confirm('Apagar este convite?')) return;
    await fetch(`/api/invites/${id}`, { method: 'DELETE' });
    load();
  };

  const revoke = async (id) => {
    if (!confirm('Remover o acesso desta pessoa à sua agenda?')) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    load();
  };

  const pending = invites.filter(i => !i.used);

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>👥 Convidados</h2>
      <p style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
        Convide por link: digite um nome, gere o link e mande pra pessoa. Ela cria a própria conta e já vê sua agenda — você não precisa do e-mail nem criar senha.
      </p>

      {/* Novo convite */}
      <form onSubmit={create} style={{
        background: 'rgba(30,16,53,0.8)', borderRadius: 16,
        border: '1px solid rgba(109,40,217,0.3)', padding: 16, marginBottom: 20,
      }}>
        <label style={{ fontSize: 12, color: '#7c3aed', display: 'block', marginBottom: 6 }}>Nome da pessoa</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex.: João"
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 14,
              background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.3)',
              color: '#e2e8f0', outline: 'none',
            }} />
          <button type="submit" disabled={loading} style={{
            padding: '10px 16px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg,#6d28d9,#a855f7)', color: '#fff', fontSize: 14, fontWeight: 700,
          }}>{loading ? '...' : '🔗 Gerar link'}</button>
        </div>
        {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>❌ {error}</p>}
      </form>

      {/* Convites pendentes (link ainda não usado) */}
      {pending.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, marginBottom: 8 }}>LINKS PENDENTES</p>
          <div style={{ marginBottom: 24 }}>
            {pending.map(i => (
              <div key={i.id} style={{
                padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{i.name}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => share(i.token, i.name)} style={{
                      padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'rgba(109,40,217,0.25)', border: '1px solid rgba(109,40,217,0.4)', color: '#c4b5fd',
                    }}>{copied === i.token ? '✅ Copiado' : '📤 Enviar link'}</button>
                    <button onClick={() => remove(i.id)} style={{
                      background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171',
                      borderRadius: 8, padding: '6px 8px', fontSize: 14,
                    }}>🗑️</button>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: '#7c3aed', marginTop: 6, wordBreak: 'break-all' }}>{linkFor(i.token)}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pessoas que já entraram */}
      <p style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, marginBottom: 8 }}>COM ACESSO À SUA AGENDA</p>
      {viewers.length === 0 ? (
        <p style={{ fontSize: 13, color: '#52525b', padding: '8px 0' }}>Ninguém entrou ainda.</p>
      ) : (
        viewers.map(u => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderRadius: 12, marginBottom: 8,
            background: 'rgba(30,16,53,0.8)', border: '1px solid rgba(109,40,217,0.2)',
          }}>
            <div>
              <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{u.name}</p>
              <p style={{ fontSize: 12, color: '#7c3aed' }}>{u.email}</p>
            </div>
            <button onClick={() => revoke(u.id)} style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', borderRadius: 8, padding: '6px 10px', fontSize: 13,
            }}>Remover</button>
          </div>
        ))
      )}
    </div>
  );
}
