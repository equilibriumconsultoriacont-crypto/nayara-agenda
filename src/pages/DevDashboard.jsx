import { useState, useEffect, useMemo } from 'react';
import Calendar from './Calendar.jsx';

const C = {
  bg: '#0b1120', panel: 'rgba(17,24,39,0.9)', border: 'rgba(148,163,184,0.2)',
  text: '#e2e8f0', muted: '#94a3b8', dim: '#64748b',
  blue: '#0ea5e9', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#a855f7',
};

const EVENTS = {
  signup: { e: '👤', t: 'Novo cadastro' }, became_owner: { e: '⭐', t: 'Criou agenda' },
  invite_created: { e: '✉️', t: 'Convite criado' }, blocked: { e: '🚫', t: 'Bloqueou' },
  unblocked: { e: '✅', t: 'Liberou' }, user_deleted: { e: '🗑️', t: 'Excluiu conta' },
  broadcast: { e: '📢', t: 'Aviso enviado' }, impersonate_start: { e: '🛠️', t: 'Entrou como' },
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
const btn = (bg, col, bd) => ({
  padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
  border: `1px solid ${bd}`, background: bg, color: col, cursor: 'pointer',
});

function ago(d) {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// Gráfico de barras dos últimos 14 dias
function Chart({ data }) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    const found = data.find(x => x.day === key);
    days.push({ key, count: found ? found.count : 0, label: dt.getDate() });
  }
  const max = Math.max(1, ...days.map(d => d.count));
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📈 Novos cadastros (14 dias)</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
        {days.map(d => (
          <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div title={`${d.count}`} style={{
              width: '100%', height: `${(d.count / max) * 70}px`, minHeight: d.count ? 3 : 1,
              background: d.count ? 'linear-gradient(180deg,#0ea5e9,#6366f1)' : 'rgba(148,163,184,0.15)',
              borderRadius: 3,
            }} />
            <span style={{ fontSize: 9, color: C.dim }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DevDashboard({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(null);
  const [peek, setPeek] = useState(null);
  const [detail, setDetail] = useState(null);
  const [bc, setBc] = useState({ title: '', body: '' });
  const [bcMsg, setBcMsg] = useState('');
  const [showBc, setShowBc] = useState(false);

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

  const removeUser = async (u) => {
    if (!confirm(`Excluir DEFINITIVAMENTE a conta de ${u.name}? Isso apaga a agenda, convites e acessos dela. Não dá pra desfazer.`)) return;
    setBusy(u.id);
    try { await fetch(`/api/dev/users/${u.id}`, { method: 'DELETE' }); await load(); }
    finally { setBusy(null); }
  };

  const impersonate = async (u) => {
    if (!confirm(`Entrar como ${u.name}? Você vai navegar no app como essa pessoa (sessão de 1h). Fica registrado no histórico.`)) return;
    const r = await fetch(`/api/dev/impersonate/${u.id}`, { method: 'POST' });
    if (r.ok) window.location.href = '/';
  };

  const openDetail = async (id) => {
    setDetail({ loading: true });
    const r = await fetch(`/api/dev/users/${id}`);
    setDetail(r.ok ? await r.json() : { error: true });
  };

  const sendBroadcast = async () => {
    if (!bc.title.trim() || !bc.body.trim()) { setBcMsg('Preencha título e mensagem'); return; }
    setBcMsg('Enviando...');
    const r = await fetch('/api/dev/broadcast', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bc),
    });
    const d = await r.json();
    setBcMsg(r.ok ? `✅ Enviado para ${d.sent}/${d.total} aparelho(s)` : `❌ ${d.error}`);
    if (r.ok) { setBc({ title: '', body: '' }); load(); }
  };

  const users = data?.users || [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter(u => {
      if (filter === 'owners' && !u.isOwner) return false;
      if (filter === 'guests' && u.isOwner) return false;
      if (filter === 'blocked' && !u.blocked) return false;
      if (s && !(u.name || '').toLowerCase().includes(s) && !(u.email || '').toLowerCase().includes(s)) return false;
      return true;
    });
  }, [users, q, filter]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
      Carregando painel...
    </div>
  );

  const s = data?.stats || {};
  const h = data?.health || {};
  const chips = [['all', 'Todos'], ['owners', 'Donos'], ['guests', 'Convidados'], ['blocked', 'Bloqueados']];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10, background: 'rgba(11,17,32,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${C.border}`, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🛠️</span>
          <div><p style={{ fontWeight: 700 }}>Painel do Desenvolvedor</p>
            <p style={{ fontSize: 11, color: C.dim }}>Agenda · visão gerencial</p></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowBc(v => !v)} style={btn('rgba(14,165,233,0.12)', C.blue, 'rgba(14,165,233,0.35)')}>📢 Avisar</button>
          <button onClick={load} style={btn('rgba(148,163,184,0.08)', C.muted, C.border)}>↻ Atualizar</button>
          <button onClick={onLogout} style={btn('rgba(239,68,68,0.12)', '#fca5a5', 'rgba(239,68,68,0.3)')}>Sair</button>
        </div>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
        {error && <p style={{ color: C.red, marginBottom: 12 }}>⚠️ {error}</p>}

        {/* Broadcast */}
        {showBc && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📢 Enviar aviso (push) para todos</p>
            <input value={bc.title} onChange={e => setBc({ ...bc, title: e.target.value })} placeholder="Título"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, marginBottom: 8, background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}`, color: C.text, outline: 'none' }} />
            <input value={bc.body} onChange={e => setBc({ ...bc, body: e.target.value })} placeholder="Mensagem"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, marginBottom: 8, background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}`, color: C.text, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={sendBroadcast} style={btn('linear-gradient(135deg,#0ea5e9,#6366f1)', '#fff', 'transparent')}>Enviar para todos</button>
              {bcMsg && <span style={{ fontSize: 12, color: bcMsg.startsWith('✅') ? C.green : C.muted }}>{bcMsg}</span>}
            </div>
          </div>
        )}

        {/* Saúde do sistema */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', marginBottom: 16, fontSize: 12,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: h.dbOk ? C.green : C.red }} />
            {h.dbOk ? 'App online' : 'Problema'} · banco {h.dbMs}ms
          </span>
          <span style={{ color: C.dim }}>v{h.version} · {h.node}</span>
          <span style={{ color: C.dim }}>⏱️ no ar {h.uptimeSec != null ? Math.floor(h.uptimeSec / 3600) + 'h' + Math.floor((h.uptimeSec % 3600) / 60) + 'm' : '—'}</span>
          <span style={{ color: C.dim }}>🧠 {h.memMb}MB</span>
          <span style={{ color: C.dim }}>🔒 cripto {h.encryption ? <b style={{ color: C.green }}>on</b> : <b style={{ color: C.amber }}>off</b>}</span>
          <span style={{ color: C.dim }}>🔔 VAPID {h.vapidCustom ? <b style={{ color: C.green }}>ok</b> : <b style={{ color: C.amber }}>padrão</b>}</span>
          <span style={{ color: C.dim }}>⏰ cron/min {h.cron?.minute ? ago(h.cron.minute) : <b style={{ color: C.amber }}>parado?</b>}</span>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 18 }}>
          <Stat label="Usuários" value={s.totalUsers} color={C.blue} hint={`+${s.newThisWeek} nesta semana`} />
          <Stat label="Donos ativos" value={s.owners} color={C.green} hint="com agenda própria" />
          <Stat label="Ativos (7d)" value={s.activeThisWeek} color={C.purple} hint="mexeram na agenda" />
          <Stat label="Convidados → donos" value={s.conversions} hint="conversões" />
          <Stat label="Acessos convidados" value={s.guests} />
          <Stat label="Convites usados" value={`${s.invitesUsed}/${s.invites}`} color={C.amber} />
          <Stat label="Turnos lançados" value={s.shifts} />
          <Stat label="Notificações on" value={s.pushEnabled} />
          <Stat label="Bloqueados" value={s.blocked} color={s.blocked ? C.red : C.text} />
        </div>

        <Chart data={data?.signupsByDay || []} />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>
          {/* Atividade recente */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🕒 Atividade recente</p>
            {(data?.events || []).length === 0 && <p style={{ color: C.dim, fontSize: 13 }}>Sem eventos ainda.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {(data?.events || []).map((ev, i) => {
                const meta = EVENTS[ev.type] || { e: '•', t: ev.type };
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12 }}>
                    <span>{meta.e}</span>
                    <span style={{ flex: 1, color: C.muted }}>
                      <b style={{ color: C.text }}>{meta.t}</b>{ev.targetName ? ` · ${ev.targetName}` : ''}{ev.detail ? ` — ${ev.detail}` : ''}
                    </span>
                    <span style={{ color: C.dim, whiteSpace: 'nowrap' }}>{ago(ev.at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filtros + busca */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '16px 0 12px' }}>
          {chips.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              ...btn(filter === k ? 'rgba(14,165,233,0.2)' : 'rgba(148,163,184,0.06)', filter === k ? C.blue : C.muted, C.border),
            }}>{l}</button>
          ))}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 Buscar..."
            style={{ flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 8, background: 'rgba(148,163,184,0.08)', border: `1px solid ${C.border}`, color: C.text, outline: 'none', fontSize: 13 }} />
        </div>

        {/* Tabela */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: 'left', background: 'rgba(148,163,184,0.05)' }}>
                  <th style={{ padding: '10px 12px' }}>Usuário</th>
                  <th style={{ padding: '10px 12px' }}>Situação</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Conv.</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Viraram donos</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Turnos</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ativo</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} style={{ borderTop: `1px solid ${C.border}`, opacity: u.blocked ? 0.55 : 1 }}>
                    <td style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => openDetail(u.id)}>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{u.email} · {fmtDate(u.createdAt)}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {u.isOwner ? <Badge color={C.green}>Dono</Badge> : <Badge color={C.dim}>Convidado</Badge>}
                        {u.blocked && <Badge color={C.red}>Bloqueado</Badge>}
                        {u.pushOn && <Badge color={C.blue}>🔔</Badge>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.guests}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.guestsOwners}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.shifts}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: C.dim }}>{ago(u.lastActivity)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button onClick={() => openDetail(u.id)} style={btn('rgba(148,163,184,0.1)', C.muted, C.border)}>Detalhes</button>
                        {u.isOwner && <button onClick={() => setPeek({ id: u.id, name: u.name })} style={btn('rgba(14,165,233,0.12)', C.blue, 'rgba(14,165,233,0.3)')}>👁️</button>}
                        <button onClick={() => impersonate(u)} style={btn('rgba(168,85,247,0.12)', C.purple, 'rgba(168,85,247,0.3)')}>Entrar como</button>
                        <button onClick={() => toggleBlock(u)} disabled={busy === u.id}
                          style={btn(u.blocked ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', u.blocked ? C.green : '#fca5a5', u.blocked ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)')}>
                          {busy === u.id ? '...' : u.blocked ? 'Liberar' : 'Bloquear'}</button>
                        <button onClick={() => removeUser(u)} disabled={busy === u.id} style={btn('rgba(239,68,68,0.08)', '#fca5a5', 'rgba(239,68,68,0.25)')}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: C.dim }}>Nenhum usuário.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ fontSize: 11, color: C.dim, marginTop: 12, textAlign: 'center' }}>
          Atualizado {h.serverTime ? new Date(h.serverTime).toLocaleString('pt-BR') : ''}
        </p>
      </div>

      {/* Detalhe do usuário */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
          onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div style={{ width: '100%', maxWidth: 460, background: '#0f172a', border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginTop: 24 }}>
            {detail.loading ? <p style={{ color: C.muted }}>Carregando...</p> : detail.error ? <p style={{ color: C.red }}>Erro.</p> : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 800 }}>{detail.name}</p>
                    <p style={{ fontSize: 12, color: C.dim }}>{detail.email} · desde {fmtDate(detail.createdAt)}</p>
                  </div>
                  <button onClick={() => setDetail(null)} style={btn('rgba(148,163,184,0.1)', C.muted, C.border)}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {detail.isOwner ? <Badge color={C.green}>Dono</Badge> : <Badge color={C.dim}>Convidado</Badge>}
                  {detail.blocked && <Badge color={C.red}>Bloqueado</Badge>}
                  {detail.pushOn && <Badge color={C.blue}>🔔 notificações on</Badge>}
                  {detail.invitedBy && <Badge color={C.purple}>entrou por {detail.invitedBy}</Badge>}
                  {detail.lastActivity && <Badge color={C.muted}>ativo há {ago(detail.lastActivity)}</Badge>}
                </div>

                <p style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Turnos: {Object.entries(detail.shiftsByType || {}).map(([k, v]) => `${k}=${v}`).join(' · ') || 'nenhum'}</p>

                <p style={{ fontSize: 13, fontWeight: 700, marginTop: 12, marginBottom: 6 }}>👥 Convidados ({detail.guests.length})</p>
                {detail.guests.length === 0 ? <p style={{ fontSize: 12, color: C.dim }}>Nenhum.</p> :
                  detail.guests.map(g => (
                    <div key={g.id} style={{ fontSize: 12, color: C.muted, padding: '3px 0' }}>
                      {g.isOwner ? '⭐' : '•'} {g.name} <span style={{ color: C.dim }}>({g.email})</span>
                    </div>
                  ))}

                <p style={{ fontSize: 13, fontWeight: 700, marginTop: 12, marginBottom: 6 }}>✉️ Convites ({detail.invites.length})</p>
                {detail.invites.length === 0 ? <p style={{ fontSize: 12, color: C.dim }}>Nenhum.</p> :
                  detail.invites.map(i => (
                    <div key={i.id} style={{ fontSize: 12, color: C.muted, padding: '3px 0' }}>
                      {i.used ? '✅' : '⏳'} {i.name} — {i.used ? 'usado' : 'pendente'}
                    </div>
                  ))}

                {detail.views.length > 0 && (
                  <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>👁️ Também vê: {detail.views.map(v => v.name).join(', ')}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Espiar agenda (somente leitura) */}
      {peek && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0f0a1e', overflow: 'auto' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15,10,30,0.95)', borderBottom: '1px solid rgba(109,40,217,0.3)' }}>
            <p style={{ fontWeight: 700, color: '#e2e8f0' }}>👁️ Agenda de {peek.name}</p>
            <button onClick={() => setPeek(null)} style={btn('rgba(148,163,184,0.1)', '#cbd5e1', 'rgba(148,163,184,0.3)')}>✕ Fechar</button>
          </div>
          <Calendar user={user} ownerId={peek.id} canEdit={false} viewingName={peek.name} />
        </div>
      )}
    </div>
  );
}
