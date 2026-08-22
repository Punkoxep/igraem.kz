const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, getPixel) {
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc(height * (1 + rowSize));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[i] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const chunkData = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(chunkData), 0);
    return Buffer.concat([len, chunkData, crc]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '..', 'client', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. icon-192x192.png: High contrast emerald (#00B050) solid rounded background with white football
const icon192 = createPNG(192, 192, (x, y, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  
  // Solid emerald rounded container
  const cornerR = 36;
  const inRoundedBox = (
    (x >= cornerR && x <= w - cornerR) ||
    (y >= cornerR && y <= h - cornerR) ||
    Math.hypot(x - cornerR, y - cornerR) <= cornerR ||
    Math.hypot(x - (w - cornerR), y - cornerR) <= cornerR ||
    Math.hypot(x - cornerR, y - (h - cornerR)) <= cornerR ||
    Math.hypot(x - (w - cornerR), y - (h - cornerR)) <= cornerR
  );

  if (!inRoundedBox) return [0, 0, 0, 0];

  // Inside football
  const ballR = 64;
  if (r <= ballR) {
    if (r >= ballR - 4) {
      return [255, 255, 255, 255]; // Outer white ring
    }
    
    // Central pentagon / details of football
    const angle = Math.atan2(y - cy, x - cx);
    if (r <= 22) {
      return [15, 23, 42, 255]; // Dark slate #0f172a
    }
    const modAngle = ((angle + Math.PI * 2) % (Math.PI * 2 / 5)) - (Math.PI / 5);
    if (r >= 38 && r <= 56 && Math.abs(modAngle) < 0.25) {
      return [15, 23, 42, 255];
    }
    if (Math.abs(r - 38) <= 2.5) {
      return [30, 41, 59, 255];
    }
    return [255, 255, 255, 255]; // White leather
  }

  // Emerald #00B050
  return [0, 176, 80, 255];
});

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), icon192);

// 2. badge-72x72.png: Monochrome white silhouette with transparent background for Android status bar
const badge72 = createPNG(72, 72, (x, y, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  
  if (r <= 32) {
    if (r >= 26) return [255, 255, 255, 255]; // Outer white circle
    if (r <= 10) return [255, 255, 255, 255]; // Center white dot
    const angle = Math.atan2(y - cy, x - cx);
    const modAngle = ((angle + Math.PI * 2) % (Math.PI * 2 / 5)) - (Math.PI / 5);
    if (r >= 18 && r <= 24 && Math.abs(modAngle) < 0.3) {
      return [255, 255, 255, 255];
    }
    return [0, 0, 0, 0];
  }
  return [0, 0, 0, 0];
});

fs.writeFileSync(path.join(iconsDir, 'badge-72x72.png'), badge72);
console.log('PNG icons created successfully in client/public/icons!');
