import { useState, useEffect } from 'react';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const TYPE_CONFIG = {
  work:    { emoji: '💼', label: 'Trabalho',  color: '#c4b5fd', bg: 'rgba(109,40,217,0.15)', border: 'rgba(109,40,217,0.3)' },
  plantao: { emoji: '🏥', label: 'Plantão',   color: '#6ee7b7', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
  off:     { emoji: '🌙', label: 'Folga',     color: '#fde68a', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)' },
};

export default function DayDetail({ date, user, onClose, onEdit, onRefresh }) {
  const [shift, setShift] = useState(null);
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [y, m, d] = date.split('-');
  const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
  const label = `${d} de ${MONTHS_PT[Number(m)-1]} de ${y}`;

  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/shifts/${date}/detail`);
      if (!r.ok) throw new Error('http ' + r.status);
      const data = await r.json();
      setShift(data.shift || null);
      setTags(data.tags || []);
      setLoadError(false);
    } catch { setLoadError(true); }
    // Owner: carrega todas as tags (para adicionar) e a lista de pessoas liberadas (responsáveis).
    if (user.role === 'owner') {
      try {
        const r2 = await fetch('/api/tags');
        if (r2.ok) setAllTags(await r2.json());
        const r3 = await fetch('/api/users');
        if (r3.ok) setViewers(await r3.json());
      } catch {}
    }
    setLoading(false);
  }

  // Salva horário / responsável / observação de um lembrete já preso no dia.
  // patch já vem completo do ShiftTagRow (startTime, notes, assignedUserId).
  async function updateShiftTag(tagId, patch) {
    await fetch(`/api/shift-tags/${date}/${tagId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await load();
    onRefresh();
  }

  async function handleDeleteShift() {
    if (!confirm('Apagar o turno deste dia? Isso não remove os lembretes.')) return;
    await fetch(`/api/shifts/${date}`, { method: 'DELETE' });
    onRefresh();
    onClose();
  }

  async function toggleTag(tag) {
    const exists = tags.find(t => t.tag_id === tag.id);
    if (exists) {
      await fetch(`/api/shift-tags/${date}/${tag.id}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/shift-tags/${date}/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }
    await load();
    onRefresh();
  }

  const cfg = shift ? TYPE_CONFIG[shift.type] : null;

  return (
    <div style={{
      position:'fixed',inset:0,zIndex:100,display:'flex',
      alignItems:'flex-end',justifyContent:'center',
      background:'rgba(0,0,0,0.75)',backdropFilter:'blur(4px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width:'100%',maxWidth:500,borderRadius:'20px 20px 0 0',
        background:'linear-gradient(180deg,#1e1035 0%,#15092e 100%)',
        border:'1px solid rgba(109,40,217,0.4)',borderBottom:'none',
        padding:'20px 20px 40px',maxHeight:'88vh',overflowY:'auto',
      }}>
        {/* Handle */}
        <div style={{width:40,height:4,background:'#6d28d9',borderRadius:2,margin:'0 auto 16px'}}/>

        {/* Header */}
        <div style={{textAlign:'center',marginBottom:20}}>
          <p style={{fontSize:18,fontWeight:700,color:'#e2e8f0',textTransform:'capitalize'}}>{dayOfWeek}</p>
          <p style={{fontSize:13,color:'#a78bfa'}}>{label}</p>
        </div>

        {loading ? (
          <p style={{textAlign:'center',color:'#7c3aed',padding:24}}>Carregando...</p>
        ) : loadError ? (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <p style={{fontSize:40,marginBottom:8}}>⚠️</p>
            <p style={{color:'#fca5a5',fontSize:14,marginBottom:12}}>Não consegui carregar este dia.</p>
            <button onClick={load} style={{
              padding:'10px 24px',borderRadius:10,border:'1px solid rgba(109,40,217,0.4)',
              background:'rgba(109,40,217,0.15)',color:'#c4b5fd',fontSize:14,fontWeight:600,
            }}>Tentar de novo</button>
          </div>
        ) : (
          <>
            {/* Shift card */}
            {!shift ? (
              <div style={{textAlign:'center',padding:'24px 0'}}>
                <p style={{fontSize:40,marginBottom:8}}>📋</p>
                <p style={{color:'#a78bfa',fontSize:14}}>Nenhum turno registrado</p>
                {user.role === 'owner' && (
                  <button onClick={onEdit} style={{
                    marginTop:16,padding:'10px 24px',borderRadius:10,border:'none',
                    background:'linear-gradient(135deg,#6d28d9,#a855f7)',color:'#fff',fontSize:14,fontWeight:600,
                  }}>+ Adicionar turno</button>
                )}
              </div>
            ) : (
              <div style={{
                background: cfg?.bg, border: `1px solid ${cfg?.border}`,
                borderRadius:16,padding:20,marginBottom:16,
              }}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:shift.type!=='off'?12:0}}>
                  <span style={{fontSize:36}}>{cfg?.emoji}</span>
                  <div>
                    <p style={{fontSize:18,fontWeight:800,color:cfg?.color}}>{cfg?.label}</p>
                    {shift.hours > 0 && (
                      <p style={{fontSize:13,color:'#a78bfa'}}>{shift.hours} horas</p>
                    )}
                  </div>
                </div>

                {/* Horário — shown prominently */}
                {shift.type !== 'off' && shift.start_time && (
                  <div style={{
                    background:'rgba(0,0,0,0.3)',borderRadius:12,padding:'12px 16px',
                    textAlign:'center',marginTop:4,
                  }}>
                    <p style={{fontSize:11,color:'#7c3aed',marginBottom:4,fontWeight:600}}>HORÁRIO</p>
                    <p style={{fontSize:32,fontWeight:800,color:'#fff',letterSpacing:2}}>
                      {shift.start_time}
                      <span style={{fontSize:20,color:'#7c3aed',margin:'0 8px'}}>→</span>
                      {shift.end_time || '?'}
                    </p>
                  </div>
                )}

                {shift.notes && (
                  <p style={{fontSize:13,color:'#94a3b8',marginTop:10,fontStyle:'italic',textAlign:'center'}}>
                    "{shift.notes}"
                  </p>
                )}
              </div>
            )}

            {/* Tags section */}
            {tags.length > 0 && (
              <div style={{marginBottom:16}}>
                <p style={{fontSize:12,color:'#7c3aed',fontWeight:600,marginBottom:8}}>🏷️ LEMBRETES</p>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {tags.map(t => (
                    <ShiftTagRow
                      key={t.tag_id}
                      t={t}
                      isOwner={user.role === 'owner'}
                      viewers={viewers}
                      onRemove={() => toggleTag({ id: t.tag_id })}
                      onSave={(patch) => updateShiftTag(t.tag_id, patch)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Owner: add tags */}
            {user.role === 'owner' && allTags.length > 0 && (
              <div style={{marginBottom:16}}>
                <p style={{fontSize:12,color:'#7c3aed',fontWeight:600,marginBottom:8}}>ADICIONAR LEMBRETES</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {allTags.filter(t => !tags.find(st => st.tag_id === t.id)).map(t => (
                    <button key={t.id} onClick={() => toggleTag(t)} style={{
                      padding:'7px 12px',borderRadius:20,fontSize:13,fontWeight:600,
                      background:'rgba(109,40,217,0.1)',
                      border:`1px solid rgba(109,40,217,0.3)`,
                      color:'#c4b5fd',display:'flex',alignItems:'center',gap:4,
                    }}>
                      {t.emoji} {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Owner: edit + delete buttons */}
            {user.role === 'owner' && shift && (
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <button onClick={onEdit} style={{
                  flex:1,padding:'13px',borderRadius:12,border:'none',
                  background:'linear-gradient(135deg,#6d28d9,#a855f7)',
                  color:'#fff',fontSize:15,fontWeight:700,
                }}>✏️ Editar</button>
                <button onClick={handleDeleteShift} style={{
                  padding:'13px 18px',borderRadius:12,
                  border:'1px solid rgba(239,68,68,0.4)',background:'rgba(239,68,68,0.12)',
                  color:'#f87171',fontSize:15,fontWeight:700,
                }}>🗑️ Apagar</button>
              </div>
            )}
          </>
        )}

        <button onClick={onClose} style={{
          width:'100%',padding:'12px',borderRadius:12,
          border:'1px solid rgba(109,40,217,0.3)',background:'rgba(109,40,217,0.1)',
          color:'#a78bfa',fontSize:15,fontWeight:600,
        }}>Fechar</button>
      </div>
    </div>
  );
}

// ── Linha de um lembrete preso no dia ──────────────────────────────────────────
// Estado LOCAL (não recarrega enquanto você digita/escolhe o horário) e salva só
// quando sai do campo (onBlur) ou troca o responsável — evita o campo fechar e
// "escolher sozinho" um horário no meio da digitação.
function ShiftTagRow({ t, isOwner, viewers, onRemove, onSave }) {
  const [start, setStart] = useState(t.start_time || '');
  const [notes, setNotes] = useState(t.notes || '');
  const [assigned, setAssigned] = useState(t.assigned_user_id ? String(t.assigned_user_id) : '');

  const persist = (over = {}) => {
    const s = over.start !== undefined ? over.start : start;
    const n = over.notes !== undefined ? over.notes : notes;
    const a = over.assigned !== undefined ? over.assigned : assigned;
    onSave({ startTime: s || null, notes: n || null, assignedUserId: a ? Number(a) : null });
  };

  const field = {
    padding: '8px', borderRadius: 8, fontSize: 13,
    background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)',
    color: '#e2e8f0', outline: 'none',
  };

  return (
    <div style={{
      padding: '10px 14px', borderRadius: 12,
      background: 'rgba(109,40,217,0.1)', border: `1px solid ${t.tag_color || '#6d28d9'}44`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{t.tag_emoji || '🏷️'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{t.tag_name}</p>
          {/* Convidado (não-owner): só leitura */}
          {!isOwner && t.start_time && (
            <p style={{ fontSize: 12, color: '#a78bfa', marginTop: 2 }}>⏰ {t.start_time}</p>
          )}
          {!isOwner && t.assignee_name && (
            <p style={{ fontSize: 12, color: '#6ee7b7', marginTop: 2 }}>👤 Responsável: {t.assignee_name}</p>
          )}
          {!isOwner && t.notes && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t.notes}</p>}
        </div>
        {isOwner && (
          <button onClick={onRemove} style={{
            background: 'rgba(239,68,68,0.15)', border: 'none',
            color: '#f87171', borderRadius: 8, padding: '4px 8px', fontSize: 14,
          }}>✕</button>
        )}
      </div>

      {isOwner && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="time" value={start}
              onChange={e => setStart(e.target.value)}
              onBlur={() => persist()}
              style={{ ...field, width: 110 }} />
            <select value={assigned}
              onChange={e => { setAssigned(e.target.value); persist({ assigned: e.target.value }); }}
              style={{ ...field, flex: 1 }}>
              <option value="">Sem responsável</option>
              {viewers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <input type="text" value={notes}
            placeholder="Observação (ex.: portão dos fundos)"
            onChange={e => setNotes(e.target.value)}
            onBlur={() => persist()}
            style={{ ...field, width: '100%' }} />
        </div>
      )}
    </div>
  );
}
