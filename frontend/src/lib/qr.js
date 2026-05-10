const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const SIZE = 21;
const DATA_CODEWORDS = 19;
const ECC_CODEWORDS = 7;

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonGenerator(degree) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data, generator) {
  const result = Array(generator.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < result.length; i += 1) {
      result[i] ^= gfMultiply(generator[i], factor);
    }
  }
  return result;
}

function encodeUserKey(userKey) {
  const bits = [];
  appendBits(bits, 0x2, 4);
  appendBits(bits, userKey.length, 9);

  for (let i = 0; i < userKey.length; i += 2) {
    const first = ALPHANUMERIC.indexOf(userKey[i]);
    const second = ALPHANUMERIC.indexOf(userKey[i + 1]);
    if (first < 0) throw new Error('Unsupported QR character.');
    if (second >= 0) appendBits(bits, first * 45 + second, 11);
    else appendBits(bits, first, 6);
  }

  appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8) bits.push(0);

  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    bytes.push(bits.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  }
  for (let pad = 0xec; bytes.length < DATA_CODEWORDS; pad ^= 0xec ^ 0x11) {
    bytes.push(pad);
  }
  return bytes;
}

function blankMatrix() {
  return {
    modules: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
    reserved: Array.from({ length: SIZE }, () => Array(SIZE).fill(false))
  };
}

function setModule(qr, row, col, value, reserve = true) {
  qr.modules[row][col] = Boolean(value);
  if (reserve) qr.reserved[row][col] = true;
}

function drawFinder(qr, row, col) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const r = row + y;
      const c = col + x;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
      const dark =
        (x >= 0 && x <= 6 && (y === 0 || y === 6)) ||
        (y >= 0 && y <= 6 && (x === 0 || x === 6)) ||
        (x >= 2 && x <= 4 && y >= 2 && y <= 4);
      setModule(qr, r, c, dark);
    }
  }
}

function drawFunctionPatterns(qr) {
  drawFinder(qr, 0, 0);
  drawFinder(qr, 0, SIZE - 7);
  drawFinder(qr, SIZE - 7, 0);

  for (let i = 0; i < SIZE; i += 1) {
    if (!qr.reserved[6][i]) setModule(qr, 6, i, i % 2 === 0);
    if (!qr.reserved[i][6]) setModule(qr, i, 6, i % 2 === 0);
  }

  setModule(qr, SIZE - 8, 8, true);
  for (let i = 0; i < 9; i += 1) {
    setModule(qr, 8, i, false);
    setModule(qr, i, 8, false);
  }
  for (let i = 0; i < 8; i += 1) {
    setModule(qr, SIZE - 1 - i, 8, false);
    setModule(qr, 8, SIZE - 1 - i, false);
  }
}

function maskBit(row, col) {
  return (row + col) % 2 === 0;
}

function drawCodewords(qr, codewords) {
  const bits = [];
  for (const byte of codewords) appendBits(bits, byte, 8);

  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const row = upward ? SIZE - 1 - vertical : vertical;
      for (let j = 0; j < 2; j += 1) {
        const col = right - j;
        if (qr.reserved[row][col]) continue;
        const rawBit = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        bitIndex += 1;
        setModule(qr, row, col, rawBit !== maskBit(row, col), false);
      }
    }
    upward = !upward;
  }
}

function drawFormatBits(qr) {
  const data = 0b01 << 3;
  let bits = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if (((bits >>> i) & 1) !== 0) bits ^= 0x537 << (i - 10);
  }
  bits = ((data << 10) | bits) ^ 0x5412;

  for (let i = 0; i <= 5; i += 1) setModule(qr, 8, i, ((bits >>> i) & 1) !== 0);
  setModule(qr, 8, 7, ((bits >>> 6) & 1) !== 0);
  setModule(qr, 8, 8, ((bits >>> 7) & 1) !== 0);
  setModule(qr, 7, 8, ((bits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i += 1) setModule(qr, 14 - i, 8, ((bits >>> i) & 1) !== 0);

  for (let i = 0; i < 8; i += 1) setModule(qr, SIZE - 1 - i, 8, ((bits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i += 1) setModule(qr, 8, SIZE - 15 + i, ((bits >>> i) & 1) !== 0);
}

export function userKeyQrModules(userKey) {
  const data = encodeUserKey(userKey);
  const ecc = reedSolomonRemainder(data, reedSolomonGenerator(ECC_CODEWORDS));
  const qr = blankMatrix();
  drawFunctionPatterns(qr);
  drawCodewords(qr, [...data, ...ecc]);
  drawFormatBits(qr);
  return qr.modules;
}
