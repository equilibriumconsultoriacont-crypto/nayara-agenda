import { useState, useEffect } from 'react';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const TYPE_CONFIG = {
  work:    { emoji: '💼', label: 'Trabalho',  color: '#c4b5fd' },
  plantao: { emoji: '🏥', label: 'Plantão',   color: '#6ee7b7' },
  off:     { emoji: '🌙', label: 'Folga',     color: '#fde68a' },
};

export default function DayDetail({ date, user, onClose, onEdit, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  const [y, m, d] = date.split('-');
  const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
  const label = `${d} de ${MONTHS_PT[Number(m)-1]} de ${y}`;

  useEffect(() => {
    load();
    if (user.role === 'owner') loadAllTags();
  }, [date]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/shifts/${date}/detail`);
      const data = await r.json();
      setData(data.shift);
      setTags(data.tags || []);
    } catch {}
    setLoading(false);
  }

  async function loadAllTags() {
    const r = await fetch('/api/tags');
    if (r.ok) setAllTags(await r.json());
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

  const shift = data;
  const cfg = shift ? TYPE_CONFIG[shift.type] : null;

  return (
    <div style={{
      position:'fixed',inset:0,zIndex:100,display:'flex',
      alignItems:'flex-end',justifyContent:'center',
      background:'rgba(0,0,0,0.75)',backdropFilter:'blur(4px)',
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        width:'100%',maxWidth:500,borderRadius:'20px 20px 0 0',
        background:'linear-gradient(180deg,#1e1035 0%,#15092e 100%)',
        border:'1px solid rgba(109,40,217,0.4)',borderBottom:'none',
        padding:'20px 20px 40px',maxHeight:'85vh',overflowY:'auto',
      }}>
        <div style={{width:40,height:4,background:'#6d28d9',borderRadius:2,margin:'0 auto 16px'}}/>

        {/* Date */}
        <div style={{textAlign:'center',marginBottom:20}}>
          <p style={{fontSize:18,fontWeight:700,color:'#e2e8f0',textTransform:'capitalize'}}>{dayOfWeek}</p>
          <p style={{fontSize:13,color:'#a78bfa'}}>{label}</p>
        </div>

        {loading ? (
          <p style={{textAlign:'center',color:'#7c3aed',padding:20}}>Carregando...</p>
        ) : (
          <>
            {/* Shift info */}
            {!shift ? (
              <div style={{textAlign:'center',padding:'20px 0',color:'#52525b'}}>
                <p style={{fontSize:32,marginBottom:8}}>📋</p>
                <p style={{color:'#a78bfa',fontSize:14}}>Nenhum turno registrado</p>
              </div>
            ) : (
              <div style={{
                background:shift.type==='off'?'rgba(251,191,36,0.1)':shift.type==='plantao'?'rgba(16,185,129,0.1)':'rgba(109,40,217,0.1)',
                border:`1px solid ${shift.type==='off'?'rgba(251,191,36,0.3)':shift.type==='plantao'?'rgba(16,185,129,0.3)':'rgba(109,40,217,0.3)'}`,
                borderRadius:16,padding:20,marginBottom:16,textAlign:'center',
              }}>
                <p style={{fontSize:40,marginBottom:8}}>{cfg?.emoji}</p>
                <p style={{fontSize:20,fontWeight:800,color:cfg?.color}}>{cfg?.label}</p>
                {shift.type !== 'off' && shift.start_time && (
                  <p style={{fontSize:28,fontWeight:700,color:'#e2e8f0',marginTop:8}}>
                    {shift.start_time} → {shift.end_time || '?'}
                  </p>
                )}
                {shift.hours > 0 && (
                  <p style={{fontSize:14,color:'#a78bfa',marginTop:4}}>{shift.hours} horas</p>
                )}
                {shift.notes && (
                  <p style={{fontSize:13,color:'#94a3b8',marginTop:8,fontStyle:'italic'}}>"{shift.notes}"</p>
                )}
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div style={{marginBottom:16}}>
                <p style={{fontSize:12,color:'#7c3aed',fontWeight:600,marginBottom:8}}>LEMBRETES DO DIA</p>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {tags.map(t => (
                    <div key={t.tag_id} style={{
                      display:'flex',alignItems:'center',gap:10,
                      padding:'10px 14px',borderRadius:12,
                      background:'rgba(109,40,217,0.1)',
                      border:`1px solid ${t.tag_color}44`,
                    }}>
                      <span style={{fontSize:20}}>{t.tag_emoji}</span>
                      <div style={{flex:1}}>
                        <p style={{fontWeight:600,color:'#e2e8f0',fontSize:14}}>{t.tag_name}</p>
                        {t.start_time && (
                          <p style={{fontSize:12,color:'#a78bfa'}}>
                            {t.start_time}{t.end_time?` → ${t.end_time}`:''}
                          </p>
                        )}
                        {t.notes && <p style={{fontSize:12,color:'#94a3b8'}}>{t.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Owner actions */}
            {user.role === 'owner' && (
              <>
                {/* Tag selector */}
                {allTags.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <p style={{fontSize:12,color:'#7c3aed',fontWeight:600,marginBottom:8}}>ADICIONAR LEMBRETES</p>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                      {allTags.map(t => {
                        const active = tags.find(st => st.tag_id === t.id);
                        return (
                          <button key={t.id} onClick={() => toggleTag(t)} style={{
                            padding:'7px 12px',borderRadius:20,fontSize:13,fontWeight:600,
                            background: active ? t.color : 'rgba(109,40,217,0.1)',
                            border:`1px solid ${active ? t.color : 'rgba(109,40,217,0.3)'}`,
                            color: active ? '#fff' : '#c4b5fd',
                            display:'flex',alignItems:'center',gap:4,
                          }}>
                            {t.emoji} {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button onClick={onEdit} style={{
                    flex:1,padding:'13px',borderRadius:12,border:'none',
                    background:'linear-gradient(135deg,#6d28d9,#a855f7)',
                    color:'#fff',fontSize:15,fontWeight:700,
                  }}>
                    ✏️ Editar turno
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <button onClick={onClose} style={{
          width:'100%',marginTop:12,padding:'12px',borderRadius:12,
          border:'1px solid rgba(109,40,217,0.3)',background:'rgba(109,40,217,0.1)',
          color:'#a78bfa',fontSize:15,fontWeight:600,
        }}>Fechar</button>
      </div>
    </div>
  );
}
