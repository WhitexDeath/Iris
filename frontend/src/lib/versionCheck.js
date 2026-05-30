export async function checkForUpdates() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`);
    if (!res.ok) return false;

    const data = await res.json();
    if (!data || !data.version) return false;

    const currentVersion = localStorage.getItem('iris_version');
    const newVersion = data.version.toString();

    if (!currentVersion) {
      // First load after this feature is added, just set it
      localStorage.setItem('iris_version', newVersion);
      return false;
    }

    if (currentVersion !== newVersion) {
      console.log(`Update detected: ${currentVersion} -> ${newVersion}`);

      // Attempt to unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      // Update version and reload
      localStorage.setItem('iris_version', newVersion);
      return true;
    }
  } catch (err) {
    console.warn('Failed to check for updates', err);
  }
  return false;
}
