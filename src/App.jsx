import { useState, useEffect, useMemo } from 'react';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Calendar from './pages/Calendar.jsx';
import Invites from './pages/Invites.jsx';
import Tags from './pages/Tags.jsx';
import Presets from './pages/Presets.jsx';
import Settings from './pages/Settings.jsx';
import SetupBanner from './components/SetupBanner.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('calendar');
  const [currentOwnerId, setCurrentOwnerId] = useState(null);
  const [activating, setActivating] = useState(false);

  // Detecta link de convite: /convite/<token>
  const inviteToken = useMemo(() => {
    const m = window.location.pathname.match(/^\/convite\/(.+)$/);
    return m ? m[1] : null;
  }, []);

  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null)
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Define a agenda atual quando o usuário carrega/muda.
  useEffect(() => {
    if (!user) return;
    const agendas = user.agendas || [];
    const ids = agendas.map(a => a.ownerId);
    if (currentOwnerId && ids.includes(currentOwnerId)) return;
    const mine = agendas.find(a => a.isMine);
    setCurrentOwnerId(mine ? mine.ownerId : (agendas[0]?.ownerId ?? user.id));
  }, [user]); // eslint-disable-line

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null); setPage('calendar'); setCurrentOwnerId(null);
  };

  const handleLoggedIn = (u) => {
    // limpa a URL do convite, se veio de lá
    if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
    setUser(u);
  };

  const activateAgenda = async () => {
    setActivating(true);
    try {
      const r = await fetch('/api/agenda/activate', { method: 'POST' });
      const d = await r.json();
      if (r.ok) { setUser(d.user); setCurrentOwnerId(d.user.id); setPage('calendar'); }
    } finally { setActivating(false); }
  };

  if (loading) return (
    <div style={{
      minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'linear-gradient(135deg,#1e1035 0%,#2d1b69 50%,#4c1d95 100%)',
    }}>
      <div style={{textAlign:'center'}}>
        <div className="splash-pulse" style={{
          width:112,height:112,borderRadius:26,margin:'0 auto 20px',
          background:'linear-gradient(135deg,#6d28d9,#a855f7)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:62,boxShadow:'0 12px 44px rgba(168,85,247,0.55)',
        }}>📅</div>
        <p style={{fontSize:21,fontWeight:800,color:'#e2e8f0',letterSpacing:0.3}}>Agenda</p>
        <p style={{color:'#c4b5fd',fontSize:13,marginTop:4}}>Carregando...</p>
      </div>
    </div>
  );

  // Sem login: se veio de um convite, mostra o cadastro; senão, o login.
  if (!user) {
    if (inviteToken) return <Register token={inviteToken} onLogin={handleLoggedIn} />;
    return <Login onLogin={handleLoggedIn} />;
  }

  const isOwner = !!user.isOwner;
  const agendas = user.agendas || [];
  const canEdit = isOwner && currentOwnerId === user.id;
  const currentAgenda = agendas.find(a => a.ownerId === currentOwnerId);

  const navItems = [
    { id:'calendar', emoji:'📅', label:'Agenda' },
    { id:'settings', emoji:'🔔', label:'Avisos' },
    ...(isOwner ? [
      { id:'horarios', emoji:'⏰', label:'Horários' },
      { id:'tags', emoji:'🏷️', label:'Lembretes' },
      { id:'invites', emoji:'👥', label:'Convidados' },
    ] : []),
  ];
  const activePage = navItems.some(n => n.id === page) ? page : 'calendar';

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <header style={{
        background:'linear-gradient(135deg,#1e1035,#2d1b69)',
        borderBottom:'1px solid rgba(109,40,217,0.3)',
        padding:'12px 16px',position:'sticky',top:0,zIndex:50,
      }}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
            <span style={{fontSize:22}}>📅</span>
            <div style={{minWidth:0}}>
              <p style={{fontSize:15,fontWeight:700,color:'#e2e8f0'}}>Agenda</p>
              <p style={{fontSize:11,color:'#a78bfa'}}>Olá, {user.name}!</p>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',
            color:'#fca5a5',borderRadius:8,padding:'6px 10px',fontSize:12,flexShrink:0,
          }}>Sair</button>
        </div>

        {/* Seletor de agenda (quando há mais de uma) */}
        {agendas.length > 1 && (
          <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:12,color:'#a78bfa'}}>Vendo:</span>
            <select value={currentOwnerId ?? ''} onChange={e=>{setCurrentOwnerId(Number(e.target.value));setPage('calendar');}}
              style={{
                flex:1,padding:'8px 10px',borderRadius:8,fontSize:13,
                background:'rgba(109,40,217,0.2)',border:'1px solid rgba(109,40,217,0.4)',
                color:'#e2e8f0',outline:'none',
              }}>
              {agendas.map(a => (
                <option key={a.ownerId} value={a.ownerId}>{a.isMine ? '📅 Minha agenda' : `👁️ ${a.name}`}</option>
              ))}
            </select>
          </div>
        )}

        {/* Convidado sem agenda própria → pode criar a dele */}
        {!isOwner && (
          <button onClick={activateAgenda} disabled={activating} style={{
            marginTop:10,width:'100%',padding:'10px',borderRadius:10,border:'none',
            background:'linear-gradient(135deg,#6d28d9,#a855f7)',color:'#fff',fontSize:13,fontWeight:700,
          }}>{activating ? 'Criando...' : '✨ Criar minha agenda'}</button>
        )}
      </header>

      <main style={{flex:1,overflow:'auto',paddingBottom:72}}>
        <SetupBanner />
        {activePage==='calendar' && (
          <Calendar user={user} ownerId={currentOwnerId ?? user.id} canEdit={canEdit}
            viewingName={currentAgenda && !currentAgenda.isMine ? currentAgenda.name : null} />
        )}
        {activePage==='settings' && <Settings user={user}/>}
        {activePage==='horarios' && <Presets user={user}/>}
        {activePage==='tags' && <Tags user={user}/>}
        {activePage==='invites' && <Invites user={user}/>}
      </main>

      <nav style={{
        position:'fixed',bottom:0,left:0,right:0,
        background:'rgba(15,10,30,0.97)',backdropFilter:'blur(10px)',
        borderTop:'1px solid rgba(109,40,217,0.3)',
        display:'flex',justifyContent:'space-around',padding:'6px 0 8px',zIndex:50,
      }}>
        {navItems.map(item=>(
          <button key={item.id} onClick={()=>setPage(item.id)} style={{
            display:'flex',flexDirection:'column',alignItems:'center',gap:2,
            background:'none',border:'none',cursor:'pointer',padding:'4px 10px',
            opacity:activePage===item.id?1:0.45,transition:'opacity 0.2s',
          }}>
            <span style={{fontSize:20}}>{item.emoji}</span>
            <span style={{fontSize:10,color:activePage===item.id?'#a78bfa':'#94a3b8',fontWeight:600}}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
