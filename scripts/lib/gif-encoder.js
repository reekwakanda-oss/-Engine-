// Minimal GIF89a encoder: indexed frames, one global palette, transparency, infinite loop.

function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map();

  const out = [];
  let acc = 0;
  let accBits = 0;
  const write = (code) => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) {
      out.push(acc & 0xff);
      acc >>>= 8;
      accBits -= 8;
    }
  };

  write(clearCode);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    write(prefix);
    if (nextCode < 4096) {
      dict.set(key, nextCode++);
      if (nextCode > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      write(clearCode);
      dict = new Map();
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    }
    prefix = k;
  }
  write(prefix);
  write(eoiCode);
  if (accBits > 0) out.push(acc & 0xff);
  return out;
}

function encodeGif({ width, height, palette, frames, delayMs, transparentIndex = 0 }) {
  let bits = 1;
  while (1 << bits < palette.length) bits++;
  const tableSize = 1 << bits;
  const minCodeSize = Math.max(2, bits);

  const bytes = [];
  const u16 = (n) => bytes.push(n & 0xff, (n >> 8) & 0xff);
  const str = (s) => {
    for (const ch of s) bytes.push(ch.charCodeAt(0));
  };

  str('GIF89a');
  u16(width);
  u16(height);
  bytes.push(0x80 | 0x70 | (bits - 1), transparentIndex, 0);
  for (let i = 0; i < tableSize; i++) {
    const [r, g, b] = palette[i] || [0, 0, 0];
    bytes.push(r, g, b);
  }

  // NETSCAPE2.0 application extension: loop forever
  bytes.push(0x21, 0xff, 0x0b);
  str('NETSCAPE2.0');
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);

  const delay = Math.max(2, Math.round(delayMs / 10));
  for (const frame of frames) {
    // Graphic control extension: disposal 2 (restore to background), transparent flag
    bytes.push(0x21, 0xf9, 0x04, (2 << 2) | 1);
    u16(delay);
    bytes.push(transparentIndex, 0x00);

    bytes.push(0x2c);
    u16(0);
    u16(0);
    u16(width);
    u16(height);
    bytes.push(0x00);

    bytes.push(minCodeSize);
    const data = lzwEncode(frame, minCodeSize);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      bytes.push(chunk.length, ...chunk);
    }
    bytes.push(0x00);
  }

  bytes.push(0x3b);
  return Buffer.from(bytes);
}

module.exports = { encodeGif, lzwEncode };
