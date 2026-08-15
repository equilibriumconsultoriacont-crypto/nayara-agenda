import { useState, useEffect } from 'react';
import { enablePush, pushSupported } from '../push.js';

// Aviso que aparece no topo do app, a cada login, enquanto o app NÃO estiver
// instalado na tela inicial OU as notificações não estiverem liberadas.
// Serve tanto para a Nayara quanto para os convidados.
export default function SetupBanner() {
  const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);

  const [standalone, setStandalone] = useState(isStandalone());
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [canInstall, setCanInstall] = useState(!!window.__deferredInstallPrompt);
  const [dismissed, setDismissed] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => { setStandalone(true); setCanInstall(false); };
    window.addEventListener('pwa-installable', onInstallable);
    window.addEventListener('pwa-installed', onInstalled);
    return () => {
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('pwa-installed', onInstalled);
    };
  }, []);

  const needInstall = !standalone;
  const needNotif = pushSupported() && perm !== 'granted' && perm !== 'unsupported';

  // Nada a fazer → não mostra.
  if (dismissed || (!needInstall && !needNotif)) return null;

  const handleInstall = async () => {
    const dp = window.__deferredInstallPrompt;
    if (!dp) return;
    setBusy(true);
    dp.prompt();
    try { await dp.userChoice; } catch {}
    window.__deferredInstallPrompt = null;
    setCanInstall(false);
    setBusy(false);
  };

  const handleEnable = async () => {
    setBusy(true); setMsg('');
    const res = await enablePush();
    setPerm(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    if (res.ok) setMsg('✅ Notificações ativadas!');
    else if (res.reason === 'denied') setMsg('❌ Permissão negada. Libere nas configurações do aparelho.');
    else setMsg('❌ Não consegui ativar. Instale o app na tela inicial primeiro.');
    setBusy(false);
  };

  return (
    <div style={{
      margin: '12px 16px 0', padding: '14px 16px', borderRadius: 14,
      background: 'linear-gradient(135deg, rgba(109,40,217,0.25), rgba(168,85,247,0.18))',
      border: '1px solid rgba(168,85,247,0.45)', position: 'relative',
    }}>
      <button onClick={() => setDismissed(true)} aria-label="Fechar" style={{
        position: 'absolute', top: 8, right: 10, background: 'none', border: 'none',
        color: '#a78bfa', fontSize: 18, lineHeight: 1,
      }}>×</button>

      <p style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14, marginBottom: 8, paddingRight: 18 }}>
        📲 Deixe a agenda completa
      </p>

      {/* Passo 1 — instalar como app */}
      {needInstall && (
        <div style={{ marginBottom: needNotif ? 12 : 4 }}>
          {isAndroid && canInstall && (
            <button onClick={handleInstall} disabled={busy} style={{
              width: '100%', padding: '11px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#6d28d9,#a855f7)', color: '#fff', fontSize: 14, fontWeight: 700,
            }}>{busy ? 'Instalando...' : '📥 Instalar o app'}</button>
          )}
          {isAndroid && !canInstall && (
            <p style={{ fontSize: 13, color: '#c4b5fd', lineHeight: 1.5 }}>
              Toque no menu <strong>⋮</strong> do navegador e em <strong>"Instalar app"</strong> (ou "Adicionar à tela inicial").
            </p>
          )}
          {isIOS && (
            <p style={{ fontSize: 13, color: '#c4b5fd', lineHeight: 1.5 }}>
              No iPhone: toque em <strong>Compartilhar</strong> (o quadrado com a seta ⬆️) e em
              <strong> "Adicionar à Tela de Início"</strong>. Depois abra o app por esse ícone.
            </p>
          )}
          {!isIOS && !isAndroid && (
            <p style={{ fontSize: 13, color: '#c4b5fd', lineHeight: 1.5 }}>
              Instale pelo ícone de instalação na barra de endereço do navegador.
            </p>
          )}
        </div>
      )}

      {/* Passo 2 — liberar notificações */}
      {needNotif && (
        <div>
          {isIOS && needInstall ? (
            <p style={{ fontSize: 13, color: '#fde68a', lineHeight: 1.5 }}>
              🔔 As notificações no iPhone só funcionam depois de instalar o app (passo acima).
            </p>
          ) : (
            <button onClick={handleEnable} disabled={busy} style={{
              width: '100%', padding: '11px', borderRadius: 10,
              border: '1px solid rgba(168,85,247,0.5)', background: 'rgba(109,40,217,0.2)',
              color: '#e9d5ff', fontSize: 14, fontWeight: 700,
            }}>{busy ? 'Ativando...' : '🔔 Liberar notificações'}</button>
          )}
        </div>
      )}

      {msg && <p style={{ fontSize: 13, marginTop: 8, color: msg.startsWith('✅') ? '#6ee7b7' : '#fca5a5' }}>{msg}</p>}
    </div>
  );
}
