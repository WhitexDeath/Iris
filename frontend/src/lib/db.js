const DB_NAME = 'iris-private-chat';
const DB_VERSION = 2;

function ensureIndex(store, name, keyPath) {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;

      if (!db.objectStoreNames.contains('identity')) {
        db.createObjectStore('identity', { keyPath: 'id' });
      }

      const messages = db.objectStoreNames.contains('messages')
        ? tx.objectStore('messages')
        : db.createObjectStore('messages', { keyPath: 'id' });
      ensureIndex(messages, 'byConversation', 'conversationKey');
      ensureIndex(messages, 'byPeer', 'peerUserKey');

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      const contacts = db.objectStoreNames.contains('contacts')
        ? tx.objectStore('contacts')
        : db.createObjectStore('contacts', { keyPath: 'userKey' });
      ensureIndex(contacts, 'byUpdated', 'updatedAt');
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function storeAction(storeName, mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = action(store);
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getIdentity() {
  return storeAction('identity', 'readonly', (store) => store.get('default'));
}

export async function saveIdentity(identity) {
  return storeAction('identity', 'readwrite', (store) => store.put({ id: 'default', ...identity }));
}

export async function replaceIdentity(identity) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['identity', 'contacts', 'messages', 'settings'], 'readwrite');
    const identityStore = tx.objectStore('identity');
    identityStore.clear();
    identityStore.put({ id: 'default', ...identity });
    tx.objectStore('contacts').clear();
    tx.objectStore('messages').clear();
    tx.objectStore('settings').delete('selectedUserKey');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSetting(id) {
  return storeAction('settings', 'readonly', (store) => store.get(id));
}

export async function saveSetting(id, value) {
  return storeAction('settings', 'readwrite', (store) => store.put({ id, value, updatedAt: Date.now() }));
}

export async function getContacts() {
  return storeAction('contacts', 'readonly', (store) => store.getAll()).then((contacts = []) =>
    contacts.sort((a, b) => (b.pinnedAt || b.updatedAt || 0) - (a.pinnedAt || a.updatedAt || 0))
  );
}

export async function saveContact(contact) {
  const now = Date.now();
  return storeAction('contacts', 'readwrite', (store) =>
    store.put({
      verified: false,
      addedAt: now,
      updatedAt: now,
      ...contact,
      updatedAt: now
    })
  );
}

export async function getContact(userKey) {
  return storeAction('contacts', 'readonly', (store) => store.get(userKey));
}

export async function saveMessage(message) {
  return storeAction('messages', 'readwrite', (store) => store.put(message));
}

export async function getMessagesForContact(peerUserKey) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const index = tx.objectStore('messages').index('byPeer');
    const request = index.getAll(peerUserKey);
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.createdAt - b.createdAt));
    request.onerror = () => reject(request.error);
  });
}

export async function deleteContact(userKey) {
  return storeAction('contacts', 'readwrite', (store) => store.delete(userKey));
}

export async function deleteMessagesForContact(peerUserKey) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const index = store.index('byPeer');
    const request = index.getAllKeys(peerUserKey);
    request.onsuccess = () => {
      const keys = request.result;
      for (const key of keys) {
        store.delete(key);
      }
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getMessage(id) {
  return storeAction('messages', 'readonly', (store) => store.get(id));
}

export async function updateMessage(id, updaterFn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const request = store.get(id);

    request.onsuccess = () => {
      const msg = request.result;
      if (!msg) return resolve(null);

      const updatedMsg = updaterFn(msg);
      if (!updatedMsg) return resolve(msg);

      const putRequest = store.put(updatedMsg);
      putRequest.onsuccess = () => resolve(updatedMsg);
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateContactUnread(userKey, increment = 1) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('contacts', 'readwrite');
    const store = tx.objectStore('contacts');
    const request = store.get(userKey);

    request.onsuccess = () => {
      const contact = request.result;
      if (!contact) return resolve(null);

      contact.unreadCount = (contact.unreadCount || 0) + increment;
      contact.updatedAt = Date.now();

      const putRequest = store.put(contact);
      putRequest.onsuccess = () => resolve(contact);
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearContactUnread(userKey) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('contacts', 'readwrite');
    const store = tx.objectStore('contacts');
    const request = store.get(userKey);

    request.onsuccess = () => {
      const contact = request.result;
      if (!contact) return resolve(null);

      if (!contact.unreadCount) return resolve(contact); // already cleared

      contact.unreadCount = 0;

      const putRequest = store.put(contact);
      putRequest.onsuccess = () => resolve(contact);
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}
