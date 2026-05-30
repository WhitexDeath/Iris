import nacl from 'tweetnacl';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToBytes(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function normalizeUserKey(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11);
}

export function isValidUserKey(value) {
  return /^IRIS-[A-F0-9]{6}$/.test(value);
}

export function createUserKey() {
  return `IRIS-${bytesToHex(nacl.randomBytes(3))}`;
}

export function createIdentity() {
  const keyPair = nacl.box.keyPair();
  return {
    userKey: createUserKey(),
    publicKey: bytesToBase64(keyPair.publicKey),
    secretKey: bytesToBase64(keyPair.secretKey),
    createdAt: Date.now()
  };
}

export function recoveryCodeForIdentity(identity) {
  const payload = encoder.encode(JSON.stringify({
    version: 1,
    userKey: identity.userKey,
    secretKey: identity.secretKey
  }));
  return `IRIS-RECOVERY-${bytesToBase64Url(payload)}`;
}

export function identityFromRecoveryCode(value) {
  const input = String(value || '').trim();
  if (!input.startsWith('IRIS-RECOVERY-')) return null;

  try {
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(input.slice('IRIS-RECOVERY-'.length))));
    if (payload?.version !== 1 || !isValidUserKey(payload.userKey) || !payload.secretKey) return null;

    const secretKey = base64ToBytes(payload.secretKey);
    if (secretKey.length !== nacl.box.secretKeyLength) return null;

    const pair = nacl.box.keyPair.fromSecretKey(secretKey);
    return {
      userKey: normalizeUserKey(payload.userKey),
      publicKey: bytesToBase64(pair.publicKey),
      secretKey: bytesToBase64(secretKey),
      createdAt: Date.now()
    };
  } catch {
    return null;
  }
}

export async function fingerprintForPublicKey(publicKey) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(publicKey));
  const hex = bytesToHex(new Uint8Array(digest)).slice(0, 32);
  return hex.match(/.{1,4}/g).join(' ');
}

export function parseContactInput(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  const userKey = normalizeUserKey(input);
  return isValidUserKey(userKey) ? { userKey } : null;
}

export async function encryptAttachment(file) {
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const ciphertext = nacl.secretbox(plaintext, nonce, key);

  return {
    blob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    mediaKey: bytesToBase64(key),
    mediaNonce: bytesToBase64(nonce),
    mimeType: file.type || 'application/octet-stream'
  };
}

export function decryptAttachment({ ciphertext, mediaKey, mediaNonce, mimeType }) {
  const plaintext = nacl.secretbox.open(
    new Uint8Array(ciphertext),
    base64ToBytes(mediaNonce),
    base64ToBytes(mediaKey)
  );
  if (!plaintext) throw new Error('Unable to decrypt attachment.');
  return new Blob([plaintext], { type: mimeType || 'application/octet-stream' });
}

export function encryptForContact({ plaintext, senderIdentity, contact }) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = encoder.encode(plaintext);
  const peerPublicKeyBytes = base64ToBytes(contact.publicKey);
  const secretKeyBytes = base64ToBytes(senderIdentity.secretKey);

  // The plaintext is encrypted before Socket.IO sees it. The server only relays
  // nonce + ciphertext and cannot decrypt without a browser-held private key.
  const ciphertext = nacl.box(messageBytes, nonce, peerPublicKeyBytes, secretKeyBytes);

  return {
    id: crypto.randomUUID(),
    senderUserKey: senderIdentity.userKey,
    recipientUserKey: contact.userKey,
    senderPublicKey: senderIdentity.publicKey,
    recipientPublicKey: contact.publicKey,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
    createdAt: Date.now()
  };
}

export function decryptFromIdentity({ envelope, recipientIdentity }) {
  const nonce = base64ToBytes(envelope.nonce);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const senderPublicKey = base64ToBytes(envelope.senderPublicKey);
  const recipientSecretKey = base64ToBytes(recipientIdentity.secretKey);

  // Decryption is local. If a contact key changed or the wrong browser identity
  // is used, TweetNaCl returns null and the ciphertext remains unreadable.
  const opened = nacl.box.open(ciphertext, nonce, senderPublicKey, recipientSecretKey);
  if (!opened) {
    throw new Error('Unable to decrypt message with this local identity.');
  }

  return decoder.decode(opened);
}
