import { useState, useEffect } from 'react';

export default function Settings({ user }) {
  const [settings, setSettings] = useState({
    notify_midnight: true,
    notify_hours_before: 0,
    notify_tags: true,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/notification-settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSettings(d); });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    await fetch('/api/notification-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setLoading(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggle = (key) => setSettings(s => ({ ...s, [key]: !s[key] }));

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
        🔔 Notificações
      </h2>
      <p style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
        Configure quando receber alertas da agenda
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Midnight notification */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', borderRadius: 14,
          background: 'rgba(30,16,53,0.8)', border: '1px solid rgba(109,40,217,0.2)',
        }}>
          <div>
            <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>🌙 Aviso à meia-noite</p>
            <p style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>Recebe às 00:00 o turno do dia</p>
          </div>
          <button onClick={() => toggle('notify_midnight')} style={{
            width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: settings.notify_midnight ? '#6d28d9' : '#374151',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              position: 'absolute', top: 4,
              left: settings.notify_midnight ? 26 : 4,
              transition: 'left 0.2s',
            }}/>
          </button>
        </div>

        {/* Hours before */}
        <div style={{
          padding: '16px', borderRadius: 14,
          background: 'rgba(30,16,53,0.8)', border: '1px solid rgba(109,40,217,0.2)',
        }}>
          <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14, marginBottom: 4 }}>⏰ Aviso antecipado</p>
          <p style={{ fontSize: 12, color: '#7c3aed', marginBottom: 12 }}>
            Receber notificação X horas antes do dia começar
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 6, 12].map(h => (
              <button key={h} onClick={() => setSettings(s => ({ ...s, notify_hours_before: h }))}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: settings.notify_hours_before === h ? '#6d28d9' : 'rgba(109,40,217,0.15)',
                  color: settings.notify_hours_before === h ? '#fff' : '#c4b5fd',
                }}>
                {h === 0 ? 'Desligado' : `${h}h antes`}
              </button>
            ))}
          </div>
        </div>

        {/* Tags notification */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', borderRadius: 14,
          background: 'rgba(30,16,53,0.8)', border: '1px solid rgba(109,40,217,0.2)',
        }}>
          <div>
            <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>🏷️ Incluir lembretes</p>
            <p style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>Mostrar lembretes do dia na notificação</p>
          </div>
          <button onClick={() => toggle('notify_tags')} style={{
            width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: settings.notify_tags ? '#6d28d9' : '#374151',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              position: 'absolute', top: 4,
              left: settings.notify_tags ? 26 : 4,
              transition: 'left 0.2s',
            }}/>
          </button>
        </div>

        {/* Info box */}
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.15)',
        }}>
          <p style={{ fontSize: 12, color: '#7c3aed', lineHeight: 1.6 }}>
            💡 Cada usuário configura suas próprias preferências.
            As notificações chegam na barra do celular quando o app está instalado na área de trabalho.
          </p>
        </div>

        <button onClick={handleSave} disabled={loading} style={{
          padding: '14px', borderRadius: 12, border: 'none',
          background: saved ? '#059669' : 'linear-gradient(135deg,#6d28d9,#a855f7)',
          color: '#fff', fontSize: 15, fontWeight: 700,
          transition: 'background 0.3s',
        }}>
          {saved ? '✅ Salvo!' : loading ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
