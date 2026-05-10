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

export function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

export async function fingerprintForPublicKey(publicKey) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(publicKey));
  const hex = bytesToHex(new Uint8Array(digest)).slice(0, 32);
  return hex.match(/.{1,4}/g).join(' ');
}

export function contactSharePayload(identity, displayName) {
  return JSON.stringify({
    type: 'iris-contact',
    version: 1,
    userKey: identity.userKey,
    displayName,
    publicKey: identity.publicKey
  });
}

export function parseContactInput(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  try {
    const parsed = JSON.parse(input);
    if (parsed?.type === 'iris-contact' && isValidUserKey(parsed.userKey) && parsed.publicKey) {
      return {
        userKey: normalizeUserKey(parsed.userKey),
        displayName: String(parsed.displayName || parsed.userKey).slice(0, 40),
        publicKey: parsed.publicKey
      };
    }
  } catch {
    // Plain User Key entry is supported; JSON parsing is only for QR payloads.
  }

  const userKey = normalizeUserKey(input);
  return isValidUserKey(userKey) ? { userKey } : null;
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
