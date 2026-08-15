import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Registra service worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Captura o prompt de instalação (Android/Chrome). No iOS este evento não existe.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-installable'));
});
window.addEventListener('appinstalled', () => {
  window.__deferredInstallPrompt = null;
  window.dispatchEvent(new Event('pwa-installed'));
});

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)
