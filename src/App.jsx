import { useState, useEffect, useCallback } from 'react';
import Login from './pages/Login.jsx';
import Calendar from './pages/Calendar.jsx';
import Users from './pages/Users.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('calendar');

  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null)
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleLogin = (u) => setUser(u);
  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
        <p style={{ color: '#a78bfa' }}>Carregando...</p>
      </div>
    </div>
  );

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1e1035 0%, #2d1b69 100%)',
        borderBottom: '1px solid rgba(109,40,217,0.3)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>📅</span>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Agenda</p>
            <p style={{ fontSize: 11, color: '#a78bfa' }}>Olá, {user.name}!</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {user.role === 'owner' && (
            <button onClick={() => setPage(p => p === 'users' ? 'calendar' : 'users')}
              style={{
                background: page === 'users' ? '#6d28d9' : 'rgba(109,40,217,0.2)',
                border: '1px solid rgba(109,40,217,0.4)',
                color: '#e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 13,
              }}>
              👥 Usuários
            </button>
          )}
          <button onClick={handleLogout}
            style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', borderRadius: 8, padding: '6px 10px', fontSize: 13,
            }}>
            Sair
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {page === 'calendar' ? <Calendar user={user} /> : <Users user={user} />}
      </main>
    </div>
  );
}
