import { useState, useEffect } from 'react';
import Login from './pages/Login.jsx';
import Calendar from './pages/Calendar.jsx';
import Users from './pages/Users.jsx';
import Tags from './pages/Tags.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('calendar');

  useEffect(() => {
    fetch('/api/me').then(r=>r.ok?r.json():null)
      .then(u=>{setUser(u);setLoading(false);})
      .catch(()=>setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null); setPage('calendar');
  };

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <span style={{fontSize:48}}>📅</span>
      <p style={{color:'#a78bfa'}}>Carregando...</p>
    </div>
  );

  if (!user) return <Login onLogin={setUser} />;

  const navItems = [
    { id: 'calendar', emoji: '📅', label: 'Agenda' },
    ...(user.role === 'owner' ? [
      { id: 'tags', emoji: '🏷️', label: 'Lembretes' },
      { id: 'users', emoji: '👥', label: 'Usuários' },
    ] : []),
  ];

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <header style={{
        background:'linear-gradient(135deg,#1e1035 0%,#2d1b69 100%)',
        borderBottom:'1px solid rgba(109,40,217,0.3)',
        padding:'12px 16px',
        display:'flex',alignItems:'center',justifyContent:'space-between',
        position:'sticky',top:0,zIndex:50,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:22}}>📅</span>
          <div>
            <p style={{fontSize:15,fontWeight:700,color:'#e2e8f0'}}>Agenda Nayara</p>
            <p style={{fontSize:11,color:'#a78bfa'}}>Olá, {user.name}! {user.role==='viewer'?'👁️':''}</p>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',
          color:'#fca5a5',borderRadius:8,padding:'6px 10px',fontSize:12,
        }}>Sair</button>
      </header>

      {/* Content */}
      <main style={{flex:1,overflow:'auto',paddingBottom:70}}>
        {page==='calendar'&&<Calendar user={user}/>}
        {page==='tags'&&<Tags user={user}/>}
        {page==='users'&&<Users user={user}/>}
      </main>

      {/* Bottom nav */}
      <nav style={{
        position:'fixed',bottom:0,left:0,right:0,
        background:'rgba(15,10,30,0.95)',backdropFilter:'blur(10px)',
        borderTop:'1px solid rgba(109,40,217,0.3)',
        display:'flex',justifyContent:'space-around',padding:'8px 0',
        zIndex:50,
      }}>
        {navItems.map(item=>(
          <button key={item.id} onClick={()=>setPage(item.id)} style={{
            display:'flex',flexDirection:'column',alignItems:'center',gap:2,
            background:'none',border:'none',cursor:'pointer',padding:'4px 20px',
            opacity:page===item.id?1:0.5,
          }}>
            <span style={{fontSize:22}}>{item.emoji}</span>
            <span style={{fontSize:10,color:page===item.id?'#a78bfa':'#94a3b8',fontWeight:600}}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
