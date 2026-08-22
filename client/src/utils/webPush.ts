/**
 * Converts a url-safe base64 string to a Uint8Array for VAPID applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks if Service Worker and Web Push are supported in this browser
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Registers the Service Worker and requests a PushSubscription using the provided VAPID public key
 */
export async function registerServiceWorkerAndSubscribe(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    throw new Error('Ваш браузер или устройство не поддерживает Web Push уведомления');
  }

  // 1. Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Разрешение на отправку уведомлений было отклонено в браузере');
  }

  // 2. Register Service Worker
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // 3. Check for existing subscription
  let subscription = await registration.pushManager.getSubscription();

  // 4. If no subscription, create a new one with applicationServerKey
  if (!subscription) {
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey as any,
    });
  }

  return subscription;
}
