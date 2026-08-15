import { useState, useEffect } from 'react';

function ViewerNotifyPanel({ viewer, onClose }) {
  const [settings, setSettings] = useState({ notify_midnight: true, notify_hours_before: 0, notify_tags: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${viewer.id}/notification-settings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSettings(d); setLoading(false); });
  }, [viewer.id]);

  const toggle = (key) => setSettings(s => ({ ...s, [key]: !s[key] }));

  const save = async () => {
    setSaving(true);
    await fetch(`/api/users/${viewer.id}/notification-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{
      position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'flex-end',justifyContent:'center',
      background:'rgba(0,0,0,0.75)',backdropFilter:'blur(4px)',
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        width:'100%',maxWidth:500,borderRadius:'20px 20px 0 0',
        background:'linear-gradient(180deg,#1e1035,#15092e)',
        border:'1px solid rgba(109,40,217,0.4)',borderBottom:'none',
        padding:'20px 20px 40px',
      }}>
        <div style={{width:40,height:4,background:'#6d28d9',borderRadius:2,margin:'0 auto 16px'}}/>
        <p style={{fontSize:16,fontWeight:700,color:'#e2e8f0',textAlign:'center',marginBottom:4}}>
          🔔 Notificações de {viewer.name}
        </p>
        <p style={{fontSize:12,color:'#7c3aed',textAlign:'center',marginBottom:20}}>
          Configure o que essa pessoa recebe
        </p>

        {loading ? (
          <p style={{textAlign:'center',color:'#7c3aed'}}>Carregando...</p>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px',borderRadius:12,background:'rgba(109,40,217,0.1)'}}>
              <p style={{color:'#e2e8f0',fontSize:14}}>🌙 Aviso à meia-noite</p>
              <button onClick={()=>toggle('notify_midnight')} style={{
                width:46,height:26,borderRadius:13,border:'none',cursor:'pointer',
                background:settings.notify_midnight?'#6d28d9':'#374151',position:'relative',
              }}>
                <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:4,left:settings.notify_midnight?24:4,transition:'left .2s'}}/>
              </button>
            </div>

            <div style={{padding:'14px',borderRadius:12,background:'rgba(109,40,217,0.1)'}}>
              <p style={{color:'#e2e8f0',fontSize:14,marginBottom:10}}>⏰ Aviso antecipado</p>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {[0,1,2,3,6,12].map(h=>(
                  <button key={h} onClick={()=>setSettings(s=>({...s,notify_hours_before:h}))} style={{
                    padding:'6px 12px',borderRadius:8,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',
                    background:settings.notify_hours_before===h?'#6d28d9':'rgba(109,40,217,0.15)',
                    color:settings.notify_hours_before===h?'#fff':'#c4b5fd',
                  }}>{h===0?'Off':`${h}h antes`}</button>
                ))}
              </div>
            </div>

            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px',borderRadius:12,background:'rgba(109,40,217,0.1)'}}>
              <p style={{color:'#e2e8f0',fontSize:14}}>🏷️ Incluir lembretes</p>
              <button onClick={()=>toggle('notify_tags')} style={{
                width:46,height:26,borderRadius:13,border:'none',cursor:'pointer',
                background:settings.notify_tags?'#6d28d9':'#374151',position:'relative',
              }}>
                <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:4,left:settings.notify_tags?24:4,transition:'left .2s'}}/>
              </button>
            </div>

            <button onClick={save} disabled={saving} style={{
              padding:'13px',borderRadius:12,border:'none',marginTop:8,
              background:'linear-gradient(135deg,#6d28d9,#a855f7)',color:'#fff',fontSize:15,fontWeight:700,
            }}>{saving?'Salvando...':'Salvar'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Users({ user }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notifyPanelFor, setNotifyPanelFor] = useState(null);

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
        Pessoas que veem sua agenda e recebem notificações
      </p>

      {users.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {users.map(u => (
            <div key={u.id} style={{
              padding: '12px 14px', borderRadius: 12, marginBottom: 8,
              background: 'rgba(30,16,53,0.8)', border: '1px solid rgba(109,40,217,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{u.name}</p>
                  <p style={{ fontSize: 12, color: '#7c3aed' }}>{u.email}</p>
                </div>
                <button onClick={() => handleDelete(u.id)} style={{
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171', borderRadius: 8, padding: '6px 10px', fontSize: 16,
                }}>🗑️</button>
              </div>
              <button onClick={() => setNotifyPanelFor(u)} style={{
                marginTop: 10, width: '100%', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)', color: '#c4b5fd',
              }}>
                🔔 Configurar notificações desta pessoa
              </button>
            </div>
          ))}
        </div>
      )}

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

      {notifyPanelFor && (
        <ViewerNotifyPanel viewer={notifyPanelFor} onClose={() => setNotifyPanelFor(null)} />
      )}
    </div>
  );
}
