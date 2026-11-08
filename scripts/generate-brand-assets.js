/**
 * TaskFlow — scripts/generate-brand-assets.js
 * Extracts and optimizes brand assets from the official TaskFlow master image.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT_DIR, 'assets', 'icons');

const SOURCE_IMAGE_PATH = '/Users/mrinalprakash/.gemini/antigravity/brain/527edcae-8db5-4d60-b706-564b2371057a/.user_uploaded/media_1794117435776_16eb78b2.png';

// ─── PNG Decoder & Encoder (Zero external dependencies) ───────────────────────

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.slice(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function decodePNG(fileBuffer) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth;
  let colorType = 6;
  const idatChunks = [];

  while (pos < fileBuffer.length) {
    const len = fileBuffer.readUInt32BE(pos);
    const type = fileBuffer.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = fileBuffer.readUInt32BE(pos + 8);
      height = fileBuffer.readUInt32BE(pos + 12);
      bitDepth = fileBuffer[pos + 16];
      colorType = fileBuffer[pos + 17];
    } else if (type === 'IDAT') {
      idatChunks.push(fileBuffer.slice(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : 3;
  const pixels = Buffer.alloc(width * height * 4);

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  const rawStride = width * bpp;
  const scanlines = Buffer.alloc(height * rawStride);
  let srcPos = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[srcPos++];
    const prevLine = y > 0 ? (y - 1) * rawStride : -1;
    const currLine = y * rawStride;
    for (let x = 0; x < rawStride; x++) {
      const rawVal = raw[srcPos++];
      const a = (x >= bpp) ? scanlines[currLine + x - bpp] : 0;
      const b = (prevLine >= 0) ? scanlines[prevLine + x] : 0;
      const c = (prevLine >= 0 && x >= bpp) ? scanlines[prevLine + x - bpp] : 0;
      let val;
      if (filter === 0) val = rawVal;
      else if (filter === 1) val = (rawVal + a) & 0xff;
      else if (filter === 2) val = (rawVal + b) & 0xff;
      else if (filter === 3) val = (rawVal + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) val = (rawVal + paeth(a, b, c)) & 0xff;
      scanlines[currLine + x] = val;
    }
  }

  // Convert scanlines to standard RGBA (4 bytes/pixel)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;
      const srcIdx = y * rawStride + x * bpp;
      pixels[dstIdx] = scanlines[srcIdx];
      pixels[dstIdx + 1] = scanlines[srcIdx + 1];
      pixels[dstIdx + 2] = scanlines[srcIdx + 2];
      pixels[dstIdx + 3] = bpp === 4 ? scanlines[srcIdx + 3] : 255;
    }
  }

  return { width, height, pixels };
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type 6: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let srcPos = 0;
  let dstPos = 0;
  for (let y = 0; y < height; y++) {
    scanlines[dstPos++] = 0; // Filter None
    rgbaBuffer.copy(scanlines, dstPos, srcPos, srcPos + width * 4);
    dstPos += width * 4;
    srcPos += width * 4;
  }

  const idatData = zlib.deflateSync(scanlines, { level: 9 });
  const idat = makeChunk('IDAT', idatData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ─── Area-Averaging Resampler with Premultiplied Alpha ─────────────────────────

function resampleRGBA(srcBuf, srcW, srcH, dstW, dstH) {
  const dstBuf = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const sy1 = dy * yRatio;
    const sy2 = (dy + 1) * yRatio;
    const startY = Math.floor(sy1);
    const endY = Math.min(Math.ceil(sy2), srcH);

    for (let dx = 0; dx < dstW; dx++) {
      const sx1 = dx * xRatio;
      const sx2 = (dx + 1) * xRatio;
      const startX = Math.floor(sx1);
      const endX = Math.min(Math.ceil(sx2), srcW);

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let totalWeight = 0;

      for (let sy = startY; sy < endY; sy++) {
        const yWeight = Math.min(sy + 1, sy2) - Math.max(sy, sy1);
        if (yWeight <= 0) continue;

        for (let sx = startX; sx < endX; sx++) {
          const xWeight = Math.min(sx + 1, sx2) - Math.max(sx, sx1);
          if (xWeight <= 0) continue;

          const weight = xWeight * yWeight;
          const idx = (sy * srcW + sx) * 4;
          const a = srcBuf[idx + 3] / 255;

          rSum += srcBuf[idx] * a * weight;
          gSum += srcBuf[idx + 1] * a * weight;
          bSum += srcBuf[idx + 2] * a * weight;
          aSum += srcBuf[idx + 3] * weight;
          totalWeight += weight;
        }
      }

      const dstIdx = (dy * dstW + dx) * 4;
      if (totalWeight > 0 && aSum > 0) {
        const avgAlpha = aSum / totalWeight;
        const norm = (avgAlpha / 255) * totalWeight;
        if (norm > 0) {
          dstBuf[dstIdx] = Math.min(255, Math.round(rSum / norm));
          dstBuf[dstIdx + 1] = Math.min(255, Math.round(gSum / norm));
          dstBuf[dstIdx + 2] = Math.min(255, Math.round(bSum / norm));
        }
        dstBuf[dstIdx + 3] = Math.min(255, Math.round(avgAlpha));
      }
    }
  }
  return dstBuf;
}

// ─── Multi-Resolution ICO Encoder ─────────────────────────────────────────────

function encodeICO(pngList) {
  const count = pngList.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4);

  const dirEntries = Buffer.alloc(count * 16);
  let offset = 6 + count * 16;
  const imageBuffers = [];

  for (let i = 0; i < count; i++) {
    const item = pngList[i];
    const entry = dirEntries.slice(i * 16, (i + 1) * 16);
    entry[0] = item.width >= 256 ? 0 : item.width;
    entry[1] = item.height >= 256 ? 0 : item.height;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4); // Planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += item.buffer.length;
    imageBuffers.push(item.buffer);
  }

  return Buffer.concat([header, dirEntries, ...imageBuffers]);
}

// ─── Main Asset Generation Process ────────────────────────────────────────────

function main() {
  console.log('TaskFlow Brand Asset Generator: Loading official logo source...');
  if (!fs.existsSync(SOURCE_IMAGE_PATH)) {
    throw new Error(`Master brand image not found at ${SOURCE_IMAGE_PATH}`);
  }

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const rawFile = fs.readFileSync(SOURCE_IMAGE_PATH);
  const { width, height, pixels } = decodePNG(rawFile);
  console.log(`Source image decoded: ${width}x${height} RGBA`);

  // 1. `taskflow-logo-full.png` — full official logo (optimized PNG)
  const fullLogoPNG = encodePNG(width, height, pixels);
  fs.writeFileSync(path.join(ICONS_DIR, 'taskflow-logo-full.png'), fullLogoPNG);
  fs.writeFileSync(path.join(ROOT_DIR, 'taskflow-logo-full.png'), fullLogoPNG);
  console.log('✓ taskflow-logo-full.png created');

  // 2. Extract Checklist Icon Symbol with Transparent Mask
  // The icon badge is situated from x=128 to 332, y=151 to 357 (centered at 230, 254)
  const bx = 230;
  const by = 254;
  const halfW = 102.5;
  const halfH = 103.5;
  const r = 46;

  function sdRoundedBox(px, py) {
    const dx = Math.abs(px - bx) - (halfW - r);
    const dy = Math.abs(py - by) - (halfH - r);
    const qx = Math.max(dx, 0);
    const qy = Math.max(dy, 0);
    const distOutside = Math.hypot(qx, qy);
    const distInside = Math.min(Math.max(dx, dy), 0);
    return distOutside + distInside - r;
  }

  // Master square crop around badge: 256x256
  const cropSize = 256;
  const cropX = Math.round(bx - cropSize / 2);
  const cropY = Math.round(by - cropSize / 2);

  const transparentCrop = Buffer.alloc(cropSize * cropSize * 4);
  const solidAppCrop = Buffer.alloc(cropSize * cropSize * 4);

  for (let y = 0; y < cropSize; y++) {
    const srcY = cropY + y;
    for (let x = 0; x < cropSize; x++) {
      const srcX = cropX + x;
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * cropSize + x) * 4;

      const dist = sdRoundedBox(srcX, srcY);

      // Transparent variant:
      let alpha = 255;
      if (dist > 2.0) {
        alpha = 0;
      } else if (dist > 0) {
        alpha = Math.round(255 * (1 - dist / 2.0));
      }

      transparentCrop[dstIdx] = pixels[srcIdx];
      transparentCrop[dstIdx + 1] = pixels[srcIdx + 1];
      transparentCrop[dstIdx + 2] = pixels[srcIdx + 2];
      transparentCrop[dstIdx + 3] = alpha;

      // Solid dark navy app icon variant:
      solidAppCrop[dstIdx] = pixels[srcIdx];
      solidAppCrop[dstIdx + 1] = pixels[srcIdx + 1];
      solidAppCrop[dstIdx + 2] = pixels[srcIdx + 2];
      solidAppCrop[dstIdx + 3] = 255;
    }
  }

  // Tight crop for crisp favicons (minimal transparent padding so checkmark & bars fill 16px/32px)
  const tightW = 216;
  const tightH = 216;
  const tightX = Math.round(bx - tightW / 2);
  const tightY = Math.round(by - tightH / 2);
  const tightCrop = Buffer.alloc(tightW * tightH * 4);

  for (let y = 0; y < tightH; y++) {
    const srcY = tightY + y;
    for (let x = 0; x < tightW; x++) {
      const srcX = tightX + x;
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * tightW + x) * 4;
      const dist = sdRoundedBox(srcX, srcY);
      let alpha = 255;
      if (dist > 2.0) {
        alpha = 0;
      } else if (dist > 0) {
        alpha = Math.round(255 * (1 - dist / 2.0));
      }
      tightCrop[dstIdx] = pixels[srcIdx];
      tightCrop[dstIdx + 1] = pixels[srcIdx + 1];
      tightCrop[dstIdx + 2] = pixels[srcIdx + 2];
      tightCrop[dstIdx + 3] = alpha;
    }
  }

  // 3. `taskflow-logo-icon.png` — extracted checklist symbol only (256x256 transparent PNG)
  const iconPNG = encodePNG(cropSize, cropSize, transparentCrop);
  fs.writeFileSync(path.join(ICONS_DIR, 'taskflow-logo-icon.png'), iconPNG);
  fs.writeFileSync(path.join(ROOT_DIR, 'taskflow-logo-icon.png'), iconPNG);
  console.log('✓ taskflow-logo-icon.png created');

  // 4. `favicon-32x32.png` & `favicon-16x16.png`
  const rgba32 = resampleRGBA(tightCrop, tightW, tightH, 32, 32);
  const rgba16 = resampleRGBA(tightCrop, tightW, tightH, 16, 16);
  const png32 = encodePNG(32, 32, rgba32);
  const png16 = encodePNG(16, 16, rgba16);

  fs.writeFileSync(path.join(ICONS_DIR, 'favicon-32x32.png'), png32);
  fs.writeFileSync(path.join(ROOT_DIR, 'favicon-32x32.png'), png32);
  fs.writeFileSync(path.join(ICONS_DIR, 'favicon-16x16.png'), png16);
  fs.writeFileSync(path.join(ROOT_DIR, 'favicon-16x16.png'), png16);
  console.log('✓ favicon-32x32.png & favicon-16x16.png created');

  // 5. `favicon.ico` (multi-resolution ICO with 16x16 and 32x32)
  const icoBuf = encodeICO([
    { width: 16, height: 16, buffer: png16 },
    { width: 32, height: 32, buffer: png32 },
  ]);
  fs.writeFileSync(path.join(ICONS_DIR, 'favicon.ico'), icoBuf);
  fs.writeFileSync(path.join(ROOT_DIR, 'favicon.ico'), icoBuf);
  console.log('✓ favicon.ico created');

  // 6. `apple-touch-icon.png` (180x180, official dark background & ambient glow)
  const rgba180 = resampleRGBA(solidAppCrop, cropSize, cropSize, 180, 180);
  const png180 = encodePNG(180, 180, rgba180);
  fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), png180);
  fs.writeFileSync(path.join(ROOT_DIR, 'apple-touch-icon.png'), png180);
  console.log('✓ apple-touch-icon.png (180x180) created');

  // 7. `icon-192.png` (192x192) & `icon-512.png` (512x512) for PWA
  const rgba192 = resampleRGBA(solidAppCrop, cropSize, cropSize, 192, 192);
  const png192 = encodePNG(192, 192, rgba192);
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), png192);
  fs.writeFileSync(path.join(ROOT_DIR, 'icon-192.png'), png192);
  console.log('✓ icon-192.png created');

  const rgba512 = resampleRGBA(solidAppCrop, cropSize, cropSize, 512, 512);
  const png512 = encodePNG(512, 512, rgba512);
  fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), png512);
  fs.writeFileSync(path.join(ROOT_DIR, 'icon-512.png'), png512);
  console.log('✓ icon-512.png created');

  // 8. `favicon.svg` (Faithful vector reproduction of the official symbol)
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
  <defs>
    <!-- Dark glassmorphic background gradient -->
    <linearGradient id="tf-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#041a22" />
      <stop offset="50%" stop-color="#05151e" />
      <stop offset="100%" stop-color="#072228" />
    </linearGradient>

    <!-- Outer glowing neon teal border -->
    <linearGradient id="tf-border-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22F2D1" />
      <stop offset="40%" stop-color="#00F0B8" />
      <stop offset="80%" stop-color="#0D9488" />
      <stop offset="100%" stop-color="#00F0B8" />
    </linearGradient>

    <!-- Frosted top-left inner sheen -->
    <linearGradient id="tf-sheen-grad" x1="0%" y1="0%" x2="60%" y2="60%">
      <stop offset="0%" stop-color="#00F0B8" stop-opacity="0.35" />
      <stop offset="40%" stop-color="#00F0B8" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#05151e" stop-opacity="0" />
    </linearGradient>

    <!-- Checklist horizontal bar gradient -->
    <linearGradient id="tf-bar-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00F0B8" />
      <stop offset="60%" stop-color="#00D4A5" />
      <stop offset="100%" stop-color="#00B894" />
    </linearGradient>

    <!-- Vibrant lower-right corner accent gradient -->
    <linearGradient id="tf-corner-accent" x1="70%" y1="70%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D4A5" stop-opacity="0.2" />
      <stop offset="60%" stop-color="#00F0B8" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#22F2D1" stop-opacity="1.0" />
    </linearGradient>

    <!-- Drop shadow for crisp checkmark depth -->
    <filter id="tf-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Outer Rounded Square Frame -->
  <rect
    x="24"
    y="24"
    width="208"
    height="208"
    rx="52"
    ry="52"
    fill="url(#tf-bg-grad)"
    stroke="url(#tf-border-grad)"
    stroke-width="7"
  />

  <!-- Frosted Sheen Overlay (Top-Left) -->
  <rect
    x="24"
    y="24"
    width="208"
    height="208"
    rx="52"
    ry="52"
    fill="url(#tf-sheen-grad)"
  />

  <!-- Lower-Right Vibrant Corner Accent Shape -->
  <path
    d="M172 232 C196 232 232 196 232 172 L232 180 C232 208.7 208.7 232 180 232 Z"
    fill="url(#tf-corner-accent)"
  />

  <!-- Horizontal Checklist Bars (Pill-shaped, aligned with official logo) -->
  <!-- Top bar (left of checkmark) -->
  <rect x="68" y="96" width="34" height="20" rx="10" ry="10" fill="url(#tf-bar-grad)" />

  <!-- Middle bar -->
  <rect x="68" y="136" width="102" height="20" rx="10" ry="10" fill="url(#tf-bar-grad)" />

  <!-- Bottom bar -->
  <rect x="68" y="176" width="76" height="20" rx="10" ry="10" fill="url(#tf-bar-grad)" />

  <!-- Official White Checkmark ✓ with Ice-Teal Sheen -->
  <polyline
    points="126,104 148,126 196,76"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="17"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#tf-glow)"
  />
</svg>`;

  fs.writeFileSync(path.join(ICONS_DIR, 'favicon.svg'), svgContent, 'utf8');
  fs.writeFileSync(path.join(ROOT_DIR, 'favicon.svg'), svgContent, 'utf8');
  console.log('✓ favicon.svg created');

  console.log('\nAll brand assets successfully generated!');
}

main();

