// Helpers de notificação push (Web Push) — usados pela Agenda e pelos Avisos.

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Ativa (ou reativa) a inscrição de push do usuário logado.
// Retorna { ok, reason } — reason ∈ 'unsupported' | 'denied' | 'error'.
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  try {
    const r = await fetch('/api/push/vapid-key');
    const { publicKey } = await r.json();
    const sw = await navigator.serviceWorker.ready;
    // Reaproveita a inscrição existente ou cria uma nova.
    let sub = await sw.pushManager.getSubscription();
    if (!sub) {
      sub = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', error: String(e) };
  }
}
