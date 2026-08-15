import { useState, useEffect } from 'react';

const EMOJIS = [
  '🏷️','🚗','💊','🍽️','🏃','💪','👥','📍','🎯','⭐','🔔','💙','🏠','🎵','📚',
  '🏥','💉','🩺','🩹','🧴','🦷','👶','🍼','🐶','🐱','🌸','💧','🧾','📞','🗓️',
  '☕','🎂','🎉','🎁','🛒','🧹','🚿','💤','🌙','☀️','⏰','✅','❤️','🙏','🚶',
];
const COLORS = ['#6d28d9','#0891b2','#059669','#d97706','#dc2626','#db2777','#7c3aed','#2563eb','#16a34a'];

export default function Tags({ user }) {
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState({ name: '', emoji: '🏷️', color: '#6d28d9' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const r = await fetch('/api/tags');
    if (r.ok) setTags(await r.json());
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const r = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await r.json();
    if (!r.ok) { setError(data.error); setLoading(false); return; }
    setForm({ name: '', emoji: '🏷️', color: '#6d28d9' });
    await load();
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover esta tag? Será removida de todos os dias também.')) return;
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>🏷️ Lembretes Personalizados</h2>
      <p style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
        Crie lembretes e adicione nos dias do calendário
      </p>

      {/* Existing tags */}
      {tags.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {tags.map(t => (
            <div key={t.id} style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'12px 14px',borderRadius:12,marginBottom:8,
              background:'rgba(30,16,53,0.8)',border:`1px solid ${t.color}44`,
            }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <span style={{ fontSize:24 }}>{t.emoji}</span>
                <div>
                  <p style={{ fontWeight:600,color:'#e2e8f0',fontSize:14 }}>{t.name}</p>
                  <div style={{ width:40,height:4,borderRadius:2,background:t.color,marginTop:3 }}/>
                </div>
              </div>
              <button onClick={() => handleDelete(t.id)} style={{
                background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',
                color:'#f87171',borderRadius:8,padding:'6px 10px',fontSize:16,
              }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {user.role === 'owner' && (
        <div style={{
          background:'rgba(30,16,53,0.8)',borderRadius:16,
          border:'1px solid rgba(109,40,217,0.3)',padding:20,
        }}>
          <p style={{ fontSize:14,fontWeight:700,color:'#c4b5fd',marginBottom:16 }}>➕ Novo Lembrete</p>
          <form onSubmit={handleAdd} style={{ display:'flex',flexDirection:'column',gap:14 }}>
            <div>
              <label style={{ fontSize:12,color:'#7c3aed',display:'block',marginBottom:6 }}>Nome *</label>
              <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
                placeholder='Ex: João me busca, Consulta médica...' required style={{
                  width:'100%',padding:'10px 12px',borderRadius:8,fontSize:14,
                  background:'rgba(109,40,217,0.1)',border:'1px solid rgba(109,40,217,0.3)',
                  color:'#e2e8f0',outline:'none',
                }}/>
            </div>

            <div>
              <label style={{ fontSize:12,color:'#7c3aed',display:'block',marginBottom:6 }}>Emoji</label>
              <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                {EMOJIS.map(e => (
                  <button key={e} type='button' onClick={() => setForm({...form,emoji:e})} style={{
                    fontSize:22,padding:6,borderRadius:8,border:'none',
                    background: form.emoji===e ? 'rgba(109,40,217,0.4)' : 'rgba(109,40,217,0.1)',
                    cursor:'pointer',
                  }}>{e}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize:12,color:'#7c3aed',display:'block',marginBottom:6 }}>Cor</label>
              <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} type='button' onClick={() => setForm({...form,color:c})} style={{
                    width:32,height:32,borderRadius:'50%',background:c,border:'none',cursor:'pointer',
                    outline: form.color===c ? `3px solid ${c}` : '3px solid transparent',
                    outlineOffset:2,
                  }}/>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div style={{
              display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:10,
              background:`${form.color}22`,border:`1px solid ${form.color}44`,
            }}>
              <span style={{fontSize:22}}>{form.emoji}</span>
              <span style={{color:'#e2e8f0',fontSize:14,fontWeight:600}}>{form.name||'Preview do lembrete'}</span>
            </div>

            {error && <p style={{color:'#f87171',fontSize:13}}>❌ {error}</p>}

            <button type='submit' disabled={loading} style={{
              padding:'12px',borderRadius:10,border:'none',
              background:'linear-gradient(135deg,#6d28d9,#a855f7)',
              color:'#fff',fontSize:15,fontWeight:700,
            }}>
              {loading ? 'Criando...' : 'Criar Lembrete'}
            </button>
          </form>
        </div>
      )}

      <div style={{
        marginTop:16,padding:'12px 14px',borderRadius:12,
        background:'rgba(109,40,217,0.08)',border:'1px solid rgba(109,40,217,0.15)',
      }}>
        <p style={{fontSize:12,color:'#7c3aed',lineHeight:1.6}}>
          💡 Após criar, abra qualquer dia no calendário e adicione o lembrete. Pode ter vários lembretes no mesmo dia!
        </p>
      </div>
    </div>
  );
}
