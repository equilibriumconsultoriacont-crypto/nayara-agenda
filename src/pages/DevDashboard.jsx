import { useState, useEffect, useMemo } from 'react';
import Calendar from './Calendar.jsx';

const C = {
  bg: '#0b1120', panel: 'rgba(17,24,39,0.9)', border: 'rgba(148,163,184,0.2)',
  text: '#e2e8f0', muted: '#94a3b8', dim: '#64748b',
  blue: '#0ea5e9', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#a855f7',
};

function Stat({ label, value, color, hint }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
      <p style={{ fontSize: 12, color: C.muted }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: color || C.text, marginTop: 2 }}>{value}</p>
      {hint && <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{hint}</p>}
    </div>
  );
}

function Badge({ children, color }) {
  return <span style={{
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
    background: `${color}22`, color, border: `1px solid ${color}44`, whiteSpace: 'nowrap',
  }}>{children}</span>;
}

export default function DevDashboard({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  const [peek, setPeek] = useState(null); // { id, name }

  const load = async () => {
    setError('');
    try {
      const r = await fetch('/api/dev/overview');
      if (!r.ok) { setError('Falha ao carregar'); setLoading(false); return; }
      setData(await r.json());
    } catch { setError('Erro de conexão'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleBlock = async (u) => {
    setBusy(u.id);
    try {
      await fetch(`/api/dev/users/${u.id}/block`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !u.blocked }),
      });
      await load();
    } finally { setBusy(null); }
  };

  const users = data?.users || [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u => (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s));
  }, [users, q]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
      Carregando painel...
    </div>
  );

  const s = data?.stats || {};
  const h = data?.health || {};

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10, background: 'rgba(11,17,32,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${C.border}`, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🛠️</span>
          <div>
            <p style={{ fontWeight: 700 }}>Painel do Desenvolvedor</p>
            <p style={{ fontSize: 11, color: C.dim }}>Agenda · visão gerencial</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{
            padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: 'rgba(148,163,184,0.08)', color: C.muted, fontSize: 13, fontWeight: 600,
          }}>↻ Atualizar</button>
          <button onClick={onLogout} style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.12)', color: '#fca5a5', fontSize: 13, fontWeight: 600,
          }}>Sair</button>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
        {error && <p style={{ color: C.red, marginBottom: 12 }}>⚠️ {error}</p>}

        {/* Saúde do sistema */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', marginBottom: 16,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: h.dbOk ? C.green : C.red }} />
            {h.dbOk ? 'App online · banco OK' : 'Problema no banco'}
          </span>
          <span style={{ fontSize: 12, color: C.dim }}>v{h.version} · {h.node}</span>
          <span style={{ fontSize: 12, color: C.dim }}>
            🔒 Criptografia: {h.encryption ? <b style={{ color: C.green }}>ligada</b> : <b style={{ color: C.amber }}>desligada</b>}
          </span>
          {s.blocked > 0 && <Badge color={C.red}>{s.blocked} bloqueado(s)</Badge>}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 18 }}>
          <Stat label="Usuários" value={s.totalUsers} color={C.blue} />
          <Stat label="Com agenda própria" value={s.owners} color={C.green} hint="donos ativos" />
          <Stat label="Convidados → donos" value={s.conversions} color={C.purple} hint="viraram usuários" />
          <Stat label="Acessos de convidados" value={s.guests} hint="vínculos de visualização" />
          <Stat label="Convites usados" value={`${s.invitesUsed}/${s.invites}`} color={C.amber} />
          <Stat label="Turnos lançados" value={s.shifts} />
          <Stat label="Notificações ativas" value={s.pushEnabled} hint="aparelhos inscritos" />
          <Stat label="Bloqueados" value={s.blocked} color={s.blocked ? C.red : C.text} />
        </div>

        {/* Busca */}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 Buscar por nome ou usuário..."
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10, marginBottom: 12,
            background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}`, color: C.text, outline: 'none', fontSize: 14,
          }} />

        {/* Tabela de usuários */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: 'left', background: 'rgba(148,163,184,0.05)' }}>
                  <th style={{ padding: '10px 12px' }}>Usuário</th>
                  <th style={{ padding: '10px 12px' }}>Situação</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Convidados</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Viraram donos</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Convites</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Turnos</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>🔔</th>
                  <th style={{ padding: '10px 12px' }}>Entrou por</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} style={{ borderTop: `1px solid ${C.border}`, opacity: u.blocked ? 0.6 : 1 }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{u.email} · {fmtDate(u.createdAt)}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {u.isOwner ? <Badge color={C.green}>Dono</Badge> : <Badge color={C.dim}>Convidado</Badge>}
                        {u.blocked && <Badge color={C.red}>Bloqueado</Badge>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.guests}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.guestsOwners}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.invitesUsed}/{u.invitesSent}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.shifts}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.pushOn ? '✅' : '—'}</td>
                    <td style={{ padding: '10px 12px', color: C.muted }}>{u.invitedBy || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {u.isOwner && (
                          <button onClick={() => setPeek({ id: u.id, name: u.name })} style={{
                            padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
                            background: 'rgba(14,165,233,0.12)', color: C.blue, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                          }}>👁️ Agenda</button>
                        )}
                        <button onClick={() => toggleBlock(u)} disabled={busy === u.id} style={{
                          padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                          border: `1px solid ${u.blocked ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
                          background: u.blocked ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: u.blocked ? C.green : '#fca5a5',
                        }}>{busy === u.id ? '...' : u.blocked ? 'Liberar' : 'Bloquear'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: C.dim }}>Nenhum usuário.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ fontSize: 11, color: C.dim, marginTop: 12, textAlign: 'center' }}>
          Atualizado {h.serverTime ? new Date(h.serverTime).toLocaleString('pt-BR') : ''}
        </p>
      </div>

      {/* Espiar agenda de um usuário (somente leitura) */}
      {peek && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0f0a1e', overflow: 'auto' }}>
          <div style={{
            position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: 'rgba(15,10,30,0.95)', borderBottom: '1px solid rgba(109,40,217,0.3)',
          }}>
            <p style={{ fontWeight: 700, color: '#e2e8f0' }}>👁️ Agenda de {peek.name}</p>
            <button onClick={() => setPeek(null)} style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.3)',
              background: 'rgba(148,163,184,0.1)', color: '#cbd5e1', fontSize: 13, fontWeight: 600,
            }}>✕ Fechar</button>
          </div>
          <Calendar user={user} ownerId={peek.id} canEdit={false} viewingName={peek.name} />
        </div>
      )}
    </div>
  );
}
