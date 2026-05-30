import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  createIdentity,
  decryptFromIdentity,
  encryptAttachment,
  encryptForContact,
  fingerprintForPublicKey,
  identityFromRecoveryCode,
  parseContactInput,
  recoveryCodeForIdentity
} from '../lib/crypto';
import {
  getContacts,
  getIdentity,
  getMessagesForContact,
  getSetting,
  saveContact,
  saveIdentity,
  saveMessage,
  saveSetting,
  replaceIdentity,
  deleteContact as dbDeleteContact,
  deleteMessagesForContact,
  updateMessage,
  updateContactUnread,
  clearContactUnread
} from '../lib/db';
import {
  playNotificationSound,
  showBrowserNotification,
  flashTabTitle,
  setTabUnreadCount
} from '../lib/notifications';

const socketUrl =
  import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin);

function parsePayload(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.type) {
      return parsed;
    }
  } catch {
    // legacy format
  }
  return { type: 'chat', text: raw };
}

function statusFromDelivery(delivery) {
  if (delivery === 'queued') return 'queued';
  if (delivery === 'delivered') return 'delivered';
  return 'sent';
}

export function useEncryptedChat() {
  const socketRef = useRef(null);
  const identityRef = useRef(null);
  const displayNameRef = useRef('Me');
  const contactsRef = useRef([]);
  const selectedContactRef = useRef(null);
  const typingTimerRef = useRef(null);
  const uploadTokenRef = useRef('');

  const [identity, setIdentity] = useState(null);
  const [fingerprint, setFingerprint] = useState('');
  const [displayName, setDisplayNameState] = useState('Me');
  const [contacts, setContacts] = useState([]);
  const [presence, setPresence] = useState({});
  const [selectedUserKey, setSelectedUserKey] = useState('');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [peerTypingKey, setPeerTypingKey] = useState('');

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.userKey === selectedUserKey) || null,
    [contacts, selectedUserKey]
  );

  const recoveryCode = useMemo(() => (identity ? recoveryCodeForIdentity(identity) : ''), [identity]);

  const setDisplayName = useCallback((value) => {
    const clean = value.slice(0, 40);
    displayNameRef.current = clean;
    setDisplayNameState(clean);
    saveSetting('displayName', clean).catch(() => undefined);
  }, []);

  const watchContacts = useCallback((items = contactsRef.current) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    socket.emit('watch-contacts', { userKeys: items.map((contact) => contact.userKey) }, (response) => {
      if (!response?.ok) return;
      const nextPresence = {};
      for (const profile of response.contacts || []) {
        nextPresence[profile.userKey] = profile;
      }
      setPresence((current) => ({ ...current, ...nextPresence }));
    });
  }, []);

  const registerIdentity = useCallback(() => {
    const socket = socketRef.current;
    const activeIdentity = identityRef.current;
    if (!socket?.connected || !activeIdentity) return;

    socket.emit(
      'register-identity',
      {
        userKey: activeIdentity.userKey,
        publicKey: activeIdentity.publicKey,
        displayName: displayNameRef.current
      },
      (response) => {
        if (!response?.ok) {
          uploadTokenRef.current = '';
          setStatus('offline');
          setError(response?.error || 'Could not register this identity with the relay.');
          return;
        }
        uploadTokenRef.current = response.uploadToken || '';
        setStatus('connected');
        setPresence((current) => ({ ...current, [activeIdentity.userKey]: response.profile }));
        watchContacts();
      }
    );
  }, [watchContacts]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const [storedIdentity, storedName, storedContacts, storedSelected] = await Promise.all([
        getIdentity(),
        getSetting('displayName'),
        getContacts(),
        getSetting('selectedUserKey')
      ]);

      let activeIdentity = storedIdentity || createIdentity();
      if (!activeIdentity.userKey) activeIdentity = { ...activeIdentity, userKey: createIdentity().userKey };
      if (!storedIdentity || !storedIdentity.userKey) await saveIdentity(activeIdentity);

      const activeName = storedName?.value || 'Me';
      const ownFingerprint = await fingerprintForPublicKey(activeIdentity.publicKey);
      const selected = storedSelected?.value || storedContacts[0]?.userKey || '';

      if (cancelled) return;

      identityRef.current = activeIdentity;
      displayNameRef.current = activeName;
      contactsRef.current = storedContacts;
      setIdentity(activeIdentity);
      setFingerprint(ownFingerprint);
      setDisplayNameState(activeName);
      setContacts(storedContacts);
      setSelectedUserKey(selected);
    }

    boot().catch(() => setError('Could not open local encrypted chat storage.'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket = io(socketUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connecting');
      registerIdentity();
    });
    socket.on('connect_error', () => setStatus('offline'));
    socket.on('disconnect', () => {
      uploadTokenRef.current = '';
      setStatus('offline');
    });
    socket.on('reconnect_attempt', () => setStatus('reconnecting'));

    socket.on('presence-update', (profile) => {
      setPresence((current) => ({ ...current, [profile.userKey]: profile }));
    });

    socket.on('typing', ({ senderUserKey, isTyping }) => {
      setPeerTypingKey(isTyping ? senderUserKey : '');
      window.clearTimeout(typingTimerRef.current);
      if (isTyping) typingTimerRef.current = window.setTimeout(() => setPeerTypingKey(''), 1800);
    });

    socket.on('encrypted-message', async (envelope) => {
      try {
        const activeIdentity = identityRef.current;
        if (!activeIdentity) return;

        let contact = contactsRef.current.find((item) => item.userKey === envelope.senderUserKey);
        if (contact && contact.publicKey !== envelope.senderPublicKey) {
          setError(`Key mismatch for ${envelope.senderUserKey}. Message blocked.`);
          return;
        }

        if (!contact) {
          const fp = await fingerprintForPublicKey(envelope.senderPublicKey);
          contact = {
            userKey: envelope.senderUserKey,
            displayName: envelope.senderUserKey,
            publicKey: envelope.senderPublicKey,
            fingerprint: fp,
            verified: false,
            addedAt: Date.now(),
            updatedAt: Date.now()
          };
          await saveContact(contact);
          contactsRef.current = [contact, ...contactsRef.current];
          setContacts(contactsRef.current);
          watchContacts(contactsRef.current);
        }

        const plaintext = decryptFromIdentity({ envelope, recipientIdentity: activeIdentity });
        const payload = parsePayload(plaintext);

        if (payload.type === 'delete') {
          const updated = await updateMessage(payload.targetId, (msg) => {
            if (msg.sender === 'peer') return { ...msg, deleted: true, deletedAt: Date.now() };
            return msg;
          });
          if (updated && selectedContactRef.current?.userKey === contact.userKey) {
            setMessages((current) => current.map((m) => (m.id === updated.id ? updated : m)));
          }
          return;
        }

        if (payload.type === 'edit') {
          const updated = await updateMessage(payload.targetId, (msg) => {
            if (msg.sender === 'peer') {
              return { ...msg, plaintext: payload.text, edited: true, editedAt: Date.now() };
            }
            return msg;
          });
          if (updated && selectedContactRef.current?.userKey === contact.userKey) {
            setMessages((current) => current.map((m) => (m.id === updated.id ? updated : m)));
          }
          return;
        }

        const message = {
          id: envelope.id,
          conversationKey: contact.userKey,
          peerUserKey: contact.userKey,
          sender: 'peer',
          plaintext,
          payload,
          envelope,
          createdAt: envelope.createdAt,
          status: envelope.queued ? 'received from queue' : 'received'
        };
        await saveMessage(message);

        const isFocused = !document.hidden && document.hasFocus() && selectedContactRef.current?.userKey === contact.userKey;

        if (!isFocused) {
          const updatedContact = await updateContactUnread(contact.userKey, 1);
          if (updatedContact) {
            contactsRef.current = contactsRef.current.map(c => c.userKey === updatedContact.userKey ? updatedContact : c);
            setContacts([...contactsRef.current]);
          }
          playNotificationSound();
          showBrowserNotification(contact.displayName, payload.text || 'Sent an encrypted attachment', () => {
            setSelectedUserKey(contact.userKey);
          });
          flashTabTitle();
        }

        if (selectedContactRef.current?.userKey === contact.userKey) {
          setMessages((current) => [...current, message]);
        }
      } catch {
        setError('A message arrived but could not be decrypted with this local identity.');
      }
    });

    socket.connect();

    return () => {
      socket.close();
      window.clearTimeout(typingTimerRef.current);
    };
  }, [registerIdentity, watchContacts]);

  useEffect(() => {
    if (identity) registerIdentity();
  }, [displayName, identity, registerIdentity]);

  useEffect(() => {
    contactsRef.current = contacts;
    watchContacts(contacts);

    const totalUnread = contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    setTabUnreadCount(totalUnread);
  }, [contacts, watchContacts]);

  const clearUnread = useCallback(async (userKey) => {
    const updatedContact = await clearContactUnread(userKey);
    if (updatedContact) {
      contactsRef.current = contactsRef.current.map(c => c.userKey === userKey ? updatedContact : c);
      setContacts([...contactsRef.current]);
    }
  }, []);

  const clearError = useCallback(() => setError(''), []);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
    if (!selectedUserKey) {
      setMessages([]);
      return;
    }

    saveSetting('selectedUserKey', selectedUserKey).catch(() => undefined);
    getMessagesForContact(selectedUserKey)
      .then((msgs) => setMessages(msgs.map((m) => ({ ...m, payload: m.payload || parsePayload(m.plaintext) }))))
      .catch(() => setError('Could not load this conversation.'));
  }, [selectedContact, selectedUserKey]);

  const addContact = useCallback(
    async (input, alias = '') => {
      const parsed = parseContactInput(input);
      if (!parsed) {
        setError('Enter a valid Iris ID, such as IRIS-8F2A91.');
        return false;
      }
      if (parsed.userKey === identityRef.current?.userKey) {
        setError('That is your own User Key.');
        return false;
      }

      const finish = async (profile) => {
        const fp = await fingerprintForPublicKey(profile.publicKey);
        const contact = {
          userKey: profile.userKey,
          displayName: alias.trim() || profile.displayName || profile.userKey,
          publicKey: profile.publicKey,
          fingerprint: fp,
          verified: false,
          addedAt: Date.now(),
          updatedAt: Date.now()
        };
        await saveContact(contact);
        const withoutDuplicate = contactsRef.current.filter((item) => item.userKey !== contact.userKey);
        contactsRef.current = [contact, ...withoutDuplicate];
        setContacts(contactsRef.current);
        setSelectedUserKey(contact.userKey);
        setError('');
        return true;
      };

      const socket = socketRef.current;
      if (!socket?.connected) {
        setError('Connect to the relay before resolving a User Key.');
        return false;
      }

      return new Promise((resolve) => {
        socket.emit('resolve-contact', { userKey: parsed.userKey }, async (response) => {
          if (!response?.ok) {
            setError(response?.error || 'Could not find that User Key.');
            resolve(false);
            return;
          }
          resolve(await finish(response.profile));
        });
      });
    },
    []
  );

  const verifyContact = useCallback(async (userKey) => {
    const contact = contactsRef.current.find((item) => item.userKey === userKey);
    if (!contact) return;
    const verified = { ...contact, verified: true, verifiedAt: Date.now(), updatedAt: Date.now() };
    await saveContact(verified);
    contactsRef.current = contactsRef.current.map((item) => (item.userKey === userKey ? verified : item));
    setContacts(contactsRef.current);
  }, []);

  const sendPayload = useCallback(async (payloadObj) => {
    const activeIdentity = identityRef.current;
    const contact = selectedContactRef.current;
    const socket = socketRef.current;
    if (!activeIdentity || !contact?.publicKey) return false;
    if (!socket?.connected) {
      setError('Reconnect to the relay before sending.');
      return false;
    }

    const stringified = JSON.stringify(payloadObj);
    const envelope = encryptForContact({ plaintext: stringified, senderIdentity: activeIdentity, contact });
    
    const localMessage = {
      id: envelope.id,
      conversationKey: contact.userKey,
      peerUserKey: contact.userKey,
      sender: 'me',
      plaintext: stringified,
      payload: payloadObj,
      envelope,
      createdAt: envelope.createdAt,
      status: 'sending'
    };

    setMessages((current) => [...current, localMessage]);
    await saveMessage(localMessage);

    socket.emit('encrypted-message', envelope, async (response) => {
      const status = response?.ok ? statusFromDelivery(response.delivery) : 'failed';
      const updated = { ...localMessage, status };
      await saveMessage(updated);
      setMessages((current) => current.map((message) => (message.id === updated.id ? updated : message)));
      if (!response?.ok) setError(response?.error || 'Message was not accepted by the relay.');
    });

    return true;
  }, []);

  const sendMessage = useCallback(async (plaintext, options = {}) => {
    const trimmed = plaintext.trim();
    if (!trimmed) return false;

    const payload = { type: 'chat', text: trimmed };
    if (options.replyTo) payload.replyTo = options.replyTo;
    return sendPayload(payload);
  }, [sendPayload]);

  const sendAttachment = useCallback(async (file, caption = '') => {
    const socket = socketRef.current;
    if (!socket?.connected || !uploadTokenRef.current) {
      setError('Reconnect to the relay before uploading an attachment.');
      return false;
    }
    if (!file?.type?.startsWith('image/')) {
      setError('Choose an image file to attach.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose an image smaller than 10 MB.');
      return false;
    }

    try {
      const encrypted = await encryptAttachment(file);
      const response = await fetch('/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-iris-upload-token': uploadTokenRef.current
        },
        body: encrypted.blob
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.mediaId) {
        setError(result.error || 'Attachment upload failed.');
        return false;
      }

      const trimmedCaption = caption.trim();
      return sendPayload({
        type: 'image',
        mediaId: result.mediaId,
        mediaKey: encrypted.mediaKey,
        mediaNonce: encrypted.mediaNonce,
        mimeType: encrypted.mimeType,
        fileName: file.name.slice(0, 120),
        caption: trimmedCaption,
        text: trimmedCaption || 'Sent an image'
      });
    } catch {
      setError('The image could not be encrypted and uploaded.');
      return false;
    }
  }, [sendPayload]);

  const editMessage = useCallback(async (messageId, newText) => {
    const trimmed = newText.trim();
    const activeIdentity = identityRef.current;
    const contact = selectedContactRef.current;
    if (!trimmed || !activeIdentity || !contact?.publicKey) return false;

    const payloadObj = { type: 'edit', targetId: messageId, text: trimmed };
    const stringified = JSON.stringify(payloadObj);
    const envelope = encryptForContact({ plaintext: stringified, senderIdentity: activeIdentity, contact });

    const updated = await updateMessage(messageId, (msg) => {
      if (msg.sender === 'me') {
         const p = msg.payload || parsePayload(msg.plaintext);
         return { ...msg, plaintext: stringified, payload: { ...p, text: trimmed }, edited: true, editedAt: Date.now() };
      }
      return msg;
    });
    
    if (updated) {
      setMessages((current) => current.map((m) => (m.id === updated.id ? updated : m)));
    }

    socketRef.current.emit('encrypted-message', envelope);
    return true;
  }, []);

  const deleteMessage = useCallback(async (messageId) => {
    const activeIdentity = identityRef.current;
    const contact = selectedContactRef.current;
    if (!activeIdentity || !contact?.publicKey) return false;

    const payloadObj = { type: 'delete', targetId: messageId };
    const stringified = JSON.stringify(payloadObj);
    const envelope = encryptForContact({ plaintext: stringified, senderIdentity: activeIdentity, contact });

    const updated = await updateMessage(messageId, (msg) => {
      if (msg.sender === 'me') return { ...msg, deleted: true, deletedAt: Date.now() };
      return msg;
    });
    
    if (updated) {
      setMessages((current) => current.map((m) => (m.id === updated.id ? updated : m)));
    }

    socketRef.current.emit('encrypted-message', envelope);
    return true;
  }, []);

  const sendTyping = useCallback((isTyping) => {
    const contact = selectedContactRef.current;
    if (!socketRef.current?.connected || !contact) return;
    socketRef.current.emit('typing', { recipientUserKey: contact.userKey, isTyping });
  }, []);

  const removeContact = useCallback(async (userKey) => {
    await dbDeleteContact(userKey);
    await deleteMessagesForContact(userKey);
    contactsRef.current = contactsRef.current.filter((c) => c.userKey !== userKey);
    setContacts([...contactsRef.current]);
    if (selectedContactRef.current?.userKey === userKey) {
      setSelectedUserKey('');
      setMessages([]);
    }
  }, []);

  const restoreIdentity = useCallback(async (value) => {
    const restored = identityFromRecoveryCode(value);
    if (!restored) {
      setError('That recovery key is not valid.');
      return false;
    }

    const activeIdentity = identityRef.current;
    const isSameIdentity =
      activeIdentity?.userKey === restored.userKey &&
      activeIdentity?.secretKey === restored.secretKey;

    if (isSameIdentity) {
      await saveIdentity(restored);
    } else {
      await replaceIdentity(restored);
    }
    window.location.reload();
    return true;
  }, []);

  return {
    identity,
    fingerprint,
    recoveryCode,
    displayName,
    setDisplayName,
    contacts,
    presence,
    selectedUserKey,
    setSelectedUserKey,
    selectedContact,
    messages,
    status,
    error,
    peerTypingKey,
    socketUrl,
    addContact,
    verifyContact,
    sendMessage,
    sendAttachment,
    editMessage,
    deleteMessage,
    clearUnread,
    clearError,
    sendTyping,
    removeContact,
    restoreIdentity,
    isReady: Boolean(identity && selectedContact?.publicKey)
  };
}
