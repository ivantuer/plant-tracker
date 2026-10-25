// Writes the leaf icons as PNG without external deps (2x2 supersampling for smooth edges).
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

// [cx, cy, rx, ry] in a 512 grid; matches public/icon.svg
const PAW = [[256, 330, 26, 120], [170, 215, 62, 110, -38], [342, 215, 62, 110, 38]];
const BG = [0x3f, 0xae, 0x6a];

function png(size) {
  const k = 512 / size;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const px = (x + (sx + 0.5) / 2) * k, py = (y + (sy + 0.5) / 2) * k;
        if (PAW.some(([cx, cy, rx, ry, deg = 0]) => {
          const a = (-deg * Math.PI) / 180, dx = px - cx, dy = py - cy;
          const u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
          return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
        })) hit++;
      }
      const a = hit / 4;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(BG[i] * (1 - a) + 255 * a);
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
writeFileSync('public/apple-touch-icon.png', png(180));
