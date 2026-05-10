import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT || 3000);
const MAX_QUEUE_PER_USER = Number(process.env.MAX_QUEUE_PER_USER || 100);
const MAX_REGISTERED_USERS = Number(process.env.MAX_REGISTERED_USERS || 200);
const PRESENCE_IDLE_TTL_MS = Number(process.env.PRESENCE_IDLE_TTL_MS || 24 * 60 * 60 * 1000);

const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'Iris backend online'
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'iris-identity-relay',
    uptime: process.uptime(),
    users: users.size,
    queuedMessages: Array.from(offlineQueues.values()).reduce(
      (total, queue) => total + queue.length,
      0
    )
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  transports: ['websocket'],
  serveClient: false,
  maxHttpBufferSize: 64 * 1024,
  pingInterval: 20000,
  pingTimeout: 20000,
  cors: {
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST']
  }
});

const users = new Map();
const offlineQueues = new Map();

function ack(callback, payload) {
  if (typeof callback === 'function') {
    callback(payload);
  }
}

function cleanUserKey(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 11);
}

function cleanText(value, max = 64) {
  return String(value || '')
    .replace(/[^\w .@-]/g, '')
    .trim()
    .slice(0, max);
}

function isValidUserKey(value) {
  return /^IRIS-[A-F0-9]{6}$/.test(value);
}

function isBase64ish(value, max = 4096) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    /^[A-Za-z0-9+/=]+$/.test(value)
  );
}

function publicProfile(user) {
  if (!user) return null;

  return {
    userKey: user.userKey,
    displayName: user.displayName,
    publicKey: user.publicKey,
    online: Boolean(user.socketId),
    lastSeen: user.lastSeen
  };
}

function notifyWatchers(changedUserKey) {
  const profile = publicProfile(users.get(changedUserKey)) || {
    userKey: changedUserKey,
    online: false,
    lastSeen: Date.now()
  };

  io.to(`watch:${changedUserKey}`).emit('presence-update', profile);
}

function queueOfflineMessage(recipientUserKey, envelope) {
  const queue = offlineQueues.get(recipientUserKey) || [];

  queue.push(envelope);

  while (queue.length > MAX_QUEUE_PER_USER) {
    queue.shift();
  }

  offlineQueues.set(recipientUserKey, queue);
}

function drainOfflineMessages(userKey, socket) {
  const queue = offlineQueues.get(userKey) || [];

  if (!queue.length) return;

  for (const envelope of queue) {
    socket.emit('encrypted-message', {
      ...envelope,
      queued: true
    });
  }

  offlineQueues.delete(userKey);
}

function validateEnvelope(payload, senderUserKey) {
  const envelope = {
    id: cleanText(payload.id, 80),
    senderUserKey,
    recipientUserKey: cleanUserKey(payload.recipientUserKey),
    senderPublicKey: payload.senderPublicKey,
    recipientPublicKey: payload.recipientPublicKey,
    nonce: payload.nonce,
    ciphertext: payload.ciphertext,
    createdAt: Number(payload.createdAt || Date.now())
  };

  if (
    !envelope.id ||
    !isValidUserKey(envelope.recipientUserKey) ||
    !isBase64ish(envelope.senderPublicKey, 128) ||
    !isBase64ish(envelope.recipientPublicKey, 128) ||
    !isBase64ish(envelope.nonce, 64) ||
    !isBase64ish(envelope.ciphertext, 8192)
  ) {
    return null;
  }

  return envelope;
}

io.on('connection', (socket) => {
  socket.on('register-identity', (payload = {}, callback) => {
    const userKey = cleanUserKey(payload.userKey);
    const displayName = cleanText(payload.displayName, 40) || 'Iris user';
    const publicKey = payload.publicKey;

    if (!isValidUserKey(userKey) || !isBase64ish(publicKey, 128)) {
      return ack(callback, {
        ok: false,
        error: 'Invalid User Key or public key.'
      });
    }

    const existing = users.get(userKey);

    if (existing && existing.publicKey !== publicKey) {
      return ack(callback, {
        ok: false,
        error: 'This User Key already belongs to a different public key.'
      });
    }

    if (!existing && users.size >= MAX_REGISTERED_USERS) {
      return ack(callback, {
        ok: false,
        error: 'Server user limit reached.'
      });
    }

    if (existing?.socketId && existing.socketId !== socket.id) {
      io.sockets.sockets.get(existing.socketId)?.disconnect(true);
    }

    socket.data.userKey = userKey;

    socket.join(`user:${userKey}`);

    users.set(userKey, {
      userKey,
      displayName,
      publicKey,
      socketId: socket.id,
      lastSeen: Date.now()
    });

    const queuedCount = offlineQueues.get(userKey)?.length || 0;

    ack(callback, {
      ok: true,
      profile: publicProfile(users.get(userKey)),
      queuedCount
    });

    notifyWatchers(userKey);

    drainOfflineMessages(userKey, socket);
  });

  socket.on('resolve-contact', (payload = {}, callback) => {
    const userKey = cleanUserKey(payload.userKey);

    if (!isValidUserKey(userKey)) {
      return ack(callback, {
        ok: false,
        error: 'Enter a valid IRIS User Key.'
      });
    }

    const profile = publicProfile(users.get(userKey));

    if (!profile) {
      return ack(callback, {
        ok: false,
        error: 'User Key has not registered on this relay yet.'
      });
    }

    ack(callback, {
      ok: true,
      profile
    });
  });

  socket.on('watch-contacts', (payload = {}, callback) => {
    const requestedKeys = Array.isArray(payload.userKeys)
      ? payload.userKeys
      : [];

    const userKeys = requestedKeys
      .map(cleanUserKey)
      .filter(isValidUserKey)
      .slice(0, 50);

    for (const room of socket.rooms) {
      if (room.startsWith('watch:')) {
        socket.leave(room);
      }
    }

    for (const userKey of userKeys) {
      socket.join(`watch:${userKey}`);
    }

    ack(callback, {
      ok: true,
      contacts: userKeys.map(
        (userKey) =>
          publicProfile(users.get(userKey)) || {
            userKey,
            online: false
          }
      )
    });
  });

  socket.on('typing', (payload = {}) => {
    const senderUserKey = socket.data.userKey;
    const recipientUserKey = cleanUserKey(payload.recipientUserKey);

    if (!senderUserKey || !isValidUserKey(recipientUserKey)) {
      return;
    }

    const recipient = users.get(recipientUserKey);

    if (!recipient?.socketId) {
      return;
    }

    io.to(`user:${recipientUserKey}`).emit('typing', {
      senderUserKey,
      isTyping: Boolean(payload.isTyping)
    });
  });

  socket.on('encrypted-message', (payload = {}, callback) => {
    const senderUserKey = socket.data.userKey;

    if (!senderUserKey) {
      return ack(callback, {
        ok: false,
        error: 'Register identity before sending.'
      });
    }

    const sender = users.get(senderUserKey);

    const envelope = validateEnvelope(payload, senderUserKey);

    if (
      !sender ||
      !envelope ||
      envelope.senderPublicKey !== sender.publicKey
    ) {
      return ack(callback, {
        ok: false,
        error: 'Invalid encrypted message envelope.'
      });
    }

    const recipient = users.get(envelope.recipientUserKey);

    if (recipient?.socketId) {
      io.to(`user:${envelope.recipientUserKey}`).emit(
        'encrypted-message',
        envelope
      );

      return ack(callback, {
        ok: true,
        delivery: 'delivered',
        receivedAt: Date.now()
      });
    }

    queueOfflineMessage(envelope.recipientUserKey, envelope);

    ack(callback, {
      ok: true,
      delivery: 'queued',
      receivedAt: Date.now()
    });
  });

  socket.on('disconnect', () => {
    const userKey = socket.data.userKey;

    if (!userKey) return;

    const user = users.get(userKey);

    if (!user || user.socketId !== socket.id) {
      return;
    }

    user.socketId = null;
    user.lastSeen = Date.now();

    notifyWatchers(userKey);
  });
});

setInterval(() => {
  const now = Date.now();

  for (const [userKey, user] of users.entries()) {
    if (
      !user.socketId &&
      now - user.lastSeen > PRESENCE_IDLE_TTL_MS
    ) {
      users.delete(userKey);

      notifyWatchers(userKey);
    }
  }
}, Math.min(PRESENCE_IDLE_TTL_MS, 10 * 60 * 1000)).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Iris backend running on port ${PORT}`);
});