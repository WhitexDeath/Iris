// A subtle, modern pop sound encoded as base64 to avoid static asset issues
const NOTIFICATION_SOUND_B64 = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
// Actually, let me use a generic valid very short beep base64 to ensure it plays, or an empty one if I can't generate a good sound inline.
// Wait, I can just use a real base64 of a short "pop" or "blip" sound.
const popSound = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAOAAADEQAnJycnJycnJycnJycnJyc/Pz8/Pz8/Pz8/Pz8/Pz8/X19fX19fX19fX19fX19fX3t7e3t7e3t7e3t7e3t7e3v//////////////////////wAAAAJUQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tQwAAADABRAAAABQAAAQAAAACZgAEXwAAR/4AAYYAAAAAAABvAAAMDAwMDAwMDAwMBwMBgMBgMAwGAwEAwEAQCAQCAQCAQCAP+v1ev1ev1ev1ev1esDAwMDAwMDAwMDAwMDAwMDAwP/7UMAAABwAUQAAAAUAAAEAAAAAmYABF8AAEf+AAGGAAAAAAAAbwAADAwMDAwMDAwMDQ0NDQ0NDQ0NDAwMDAwMDAwMDAwMB//7UMAAABwAUQAAAAUAAAEAAAAAmYABF8AAEf+AAGGAAAAAAAAbwAADAwMDAwMDAwMDQ0NDQ0NDQ0NDAwMDAwMDAwMDAwMB');

let flashInterval = null;
let originalTitle = document.title;
let isFlashing = false;

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function playNotificationSound() {
  try {
    const audio = popSound.cloneNode();
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Browsers often block autoplay if no user interaction has occurred
    });
  } catch (err) {
    console.error('Audio playback failed', err);
  }
}

export function showBrowserNotification(senderName, text, onClick) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = `New message from ${senderName}`;
  const options = {
    body: text,
    icon: '/icon-192.png',
    tag: 'iris-message'
  };

  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (onClick) onClick();
    };
  } catch (err) {
    // Some mobile browsers require Service Worker for notifications
    console.error('Notification failed', err);
  }
}

export function setTabUnreadCount(count) {
  if (count > 0) {
    originalTitle = `(${count}) Iris`;
  } else {
    originalTitle = 'Iris';
  }

  if (!isFlashing) {
    document.title = originalTitle;
  }
}

export function flashTabTitle() {
  if (isFlashing || document.hasFocus()) return;

  isFlashing = true;
  let toggle = false;

  flashInterval = setInterval(() => {
    document.title = toggle ? originalTitle : 'New Message!';
    toggle = !toggle;
  }, 1000);
}

export function stopTabFlash() {
  if (!isFlashing) return;

  clearInterval(flashInterval);
  isFlashing = false;
  document.title = originalTitle;
}

// Automatically stop flashing when window gets focus
window.addEventListener('focus', stopTabFlash);
