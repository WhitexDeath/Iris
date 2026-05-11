import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  contactSharePayload,
  createIdentity,
  decryptFromIdentity,
  encryptForContact,
  fingerprintForPublicKey,
  isValidUserKey,
  normalizeUserKey,
  parseContactInput
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
  deleteContact as dbDeleteContact,
  deleteMessagesForContact
} from '../lib/db';

const socketUrl =
  import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin);

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

  const sharePayload = useMemo(
    () => (identity ? contactSharePayload(identity, displayName) : ''),
    [displayName, identity]
  );

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
          setError(response?.error || 'Could not register this identity with the relay.');
          return;
        }
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
      setStatus('connected');
      registerIdentity();
    });
    socket.on('connect_error', () => setStatus('offline'));
    socket.on('disconnect', () => setStatus('offline'));
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
        const message = {
          id: envelope.id,
          conversationKey: contact.userKey,
          peerUserKey: contact.userKey,
          sender: 'peer',
          plaintext,
          envelope,
          createdAt: envelope.createdAt,
          status: envelope.queued ? 'received from queue' : 'received'
        };
        await saveMessage(message);
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
  }, [identity, registerIdentity]);

  useEffect(() => {
    contactsRef.current = contacts;
    watchContacts(contacts);
  }, [contacts, watchContacts]);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
    if (!selectedUserKey) {
      setMessages([]);
      return;
    }

    saveSetting('selectedUserKey', selectedUserKey).catch(() => undefined);
    getMessagesForContact(selectedUserKey)
      .then(setMessages)
      .catch(() => setError('Could not load this conversation.'));
  }, [selectedContact, selectedUserKey]);

  const addContact = useCallback(
    async (input, alias = '') => {
      const parsed = parseContactInput(input);
      if (!parsed) {
        setError('Enter an IRIS User Key or scan/share a full Iris contact QR payload.');
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

      if (parsed.publicKey) return finish(parsed);

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

  const sendMessage = useCallback(async (plaintext) => {
    const trimmed = plaintext.trim();
    const activeIdentity = identityRef.current;
    const contact = selectedContactRef.current;
    if (!trimmed || !activeIdentity || !contact?.publicKey) return false;

    const envelope = encryptForContact({ plaintext: trimmed, senderIdentity: activeIdentity, contact });
    const localMessage = {
      id: envelope.id,
      conversationKey: contact.userKey,
      peerUserKey: contact.userKey,
      sender: 'me',
      plaintext: trimmed,
      envelope,
      createdAt: envelope.createdAt,
      status: 'sending'
    };

    setMessages((current) => [...current, localMessage]);
    await saveMessage(localMessage);

    socketRef.current.emit('encrypted-message', envelope, async (response) => {
      const status = response?.ok ? statusFromDelivery(response.delivery) : 'failed';
      const updated = { ...localMessage, status };
      await saveMessage(updated);
      setMessages((current) => current.map((message) => (message.id === updated.id ? updated : message)));
      if (!response?.ok) setError(response?.error || 'Message was not accepted by the relay.');
    });

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

  return {
    identity,
    fingerprint,
    sharePayload,
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
    sendTyping,
    removeContact,
    isReady: Boolean(identity && selectedContact?.publicKey)
  };
}
