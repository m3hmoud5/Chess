import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import esbuild from 'esbuild';

const rootDir = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(rootDir, 'scripts', 'mahmoud-chess-offline.source.html');
const outputPath = path.join(rootDir, 'public', 'assets', 'aistudio', 'Mahmoud_Chess_ff494bba.html');

const rawHtml = fs.readFileSync(sourcePath, 'utf8');

const styleMatch = rawHtml.match(/<style>([\s\S]*?)<\/style>/i);
const bodyMatch = rawHtml.match(/<body>([\s\S]*?)<script>([\s\S]*?)<\/script>\s*<\/body>/i);

if (!styleMatch || !bodyMatch) {
  throw new Error('Could not parse <style>, <body>, or <script> from offline source HTML');
}

const rawCss = styleMatch[1];
const rawBody = bodyMatch[1].trim();
const rawJs = bodyMatch[2].replace(/^\s*["']use strict["'];?\s*/i, '');

const minCss = esbuild.transformSync(rawCss, {
  loader: 'css',
  minify: true,
}).code.trim();

const minBody = rawBody
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')
  .trim();

const wrappedJs = `(() => {\n"use strict";\n${rawJs}\n})();`;
const minJs = esbuild.transformSync(wrappedJs, {
  loader: 'js',
  minify: true,
  target: 'es2020',
}).code.trim();

const payloadJson = JSON.stringify({
  c: minCss,
  b: minBody,
  j: minJs,
});

const plainBytes = Buffer.from(payloadJson, 'utf8');

// Dual 32-bit FNV-1a / Murmur-like integrity tags (pure JS compatible, no crypto.subtle needed on file://)
function computeTags(bytes) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    h1 ^= byte;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((byte + (i & 255)) & 255), 0x85ebca6b) >>> 0;
    h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
  }
  return [h1 >>> 0, h2 >>> 0];
}

const [plainH1, plainH2] = computeTags(plainBytes);

// Generate fresh random 32-byte key + 8-byte nonce on each build
const keyBytes = Array.from(crypto.randomBytes(32));
const nonceBytes = Array.from(crypto.randomBytes(8));

// Derive obfuscated key-mask constants so the literal key never sits cleanly in source
const keyMask = Array.from(crypto.randomBytes(32));
const maskedKey = keyBytes.map((k, i) => (k ^ keyMask[i] ^ ((i * 73 + 41) & 255)) & 255);

// Stream cipher with position-dependent keystream + rolling feedback
function encryptBytes(input, key, nonce) {
  const out = Buffer.allocUnsafe(input.length);
  let state = (nonce[0] | (nonce[1] << 8) | (nonce[2] << 16) | (nonce[3] << 24)) >>> 0;
  let acc = (nonce[4] | (nonce[5] << 8) | (nonce[6] << 16) | (nonce[7] << 24)) >>> 0;
  for (let i = 0; i < input.length; i++) {
    const k = key[i & 31];
    const n = nonce[i & 7];
    state = (Math.imul(state ^ k ^ (i & 255), 0x45d9f3b) + 0x27d4eb2f) >>> 0;
    acc = ((acc << 7) | (acc >>> 25)) ^ state ^ n;
    acc = (acc >>> 0);
    const ks = ((state >>> 16) ^ (acc >>> 8) ^ k ^ ((i * 29) & 255)) & 255;
    const p = input[i];
    const enc = ((p ^ ks) + (acc & 31)) & 255;
    out[i] = enc;
    // Key-schedule feedback tied to ciphertext byte
    acc = (acc ^ (enc + 17)) >>> 0;
  }
  return out;
}

const cipherBytes = encryptBytes(plainBytes, keyBytes, nonceBytes);
const [cipherH1, cipherH2] = computeTags(cipherBytes);

// Split Base64 cipher payload into shuffled/reindexed chunks so static string scans are harder
const b64 = cipherBytes.toString('base64');
const chunkSize = 1800;
const rawChunks = [];
for (let i = 0; i < b64.length; i += chunkSize) {
  rawChunks.push(b64.slice(i, i + chunkSize));
}

// Shuffle chunk storage order so static scanning cannot read contiguous base64
const order = rawChunks.map((_, idx) => idx);
for (let i = order.length - 1; i > 0; i--) {
  const j = crypto.randomInt(0, i + 1);
  [order[i], order[j]] = [order[j], order[i]];
}
const shuffledChunks = new Array(rawChunks.length);
const inverseOrder = new Array(rawChunks.length);
for (let pos = 0; pos < order.length; pos++) {
  shuffledChunks[pos] = rawChunks[order[pos]];
  inverseOrder[order[pos]] = pos;
}

const loaderSource = `(() => {
  "use strict";
  const _mk = ${JSON.stringify(maskedKey)};
  const _km = ${JSON.stringify(keyMask)};
  const _nn = ${JSON.stringify(nonceBytes)};
  const _ph = [${plainH1}, ${plainH2}];
  const _ch = [${cipherH1}, ${cipherH2}];
  const _cd = ${JSON.stringify(shuffledChunks)};
  const _od = ${JSON.stringify(inverseOrder)};

  const _fail = (msg) => {
    document.body.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;color:#fca5a5;font-family:system-ui,sans-serif;direction:rtl"><div style="max-width:360px;background:#1b2230;border:1px solid #ef535066;border-radius:14px;padding:20px"><h2 style="margin:0 0 8px;font-size:1.1rem">تعذر تشغيل التطبيق</h2><p style="margin:0;color:#cbd5e1;font-size:.9rem;line-height:1.6">' + msg + '</p></div></div>';
  };

  const _tags = (bytes) => {
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      h1 ^= b;
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ ((b + (i & 255)) & 255), 0x85ebca6b) >>> 0;
      h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
    }
    return [h1 >>> 0, h2 >>> 0];
  };

  try {
    let rawB64 = '';
    for (let i = 0; i < _od.length; i++) rawB64 += _cd[_od[i]];
    const bin = atob(rawB64);
    const enc = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) enc[i] = bin.charCodeAt(i);

    const ct = _tags(enc);
    if (ct[0] !== _ch[0] || ct[1] !== _ch[1]) {
      _fail('تم اكتشاف تعديل غير مصرح به في الكود.');
      return;
    }

    const key = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      key[i] = (_mk[i] ^ _km[i] ^ ((i * 73 + 41) & 255)) & 255;
    }

    const out = new Uint8Array(enc.length);
    let state = (_nn[0] | (_nn[1] << 8) | (_nn[2] << 16) | (_nn[3] << 24)) >>> 0;
    let acc = (_nn[4] | (_nn[5] << 8) | (_nn[6] << 16) | (_nn[7] << 24)) >>> 0;

    for (let i = 0; i < enc.length; i++) {
      const k = key[i & 31];
      const n = _nn[i & 7];
      state = (Math.imul(state ^ k ^ (i & 255), 0x45d9f3b) + 0x27d4eb2f) >>> 0;
      acc = (((acc << 7) | (acc >>> 25)) ^ state ^ n) >>> 0;
      const ks = ((state >>> 16) ^ (acc >>> 8) ^ k ^ ((i * 29) & 255)) & 255;
      const e = enc[i];
      out[i] = (((e - (acc & 31)) & 255) ^ ks) & 255;
      acc = (acc ^ (e + 17)) >>> 0;
    }

    const pt = _tags(out);
    if (pt[0] !== _ph[0] || pt[1] !== _ph[1]) {
      _fail('تعذر التحقق من سلامة البيانات المشفرة.');
      return;
    }

    const jsonText = new TextDecoder('utf-8').decode(out);
    const bundle = JSON.parse(jsonText);

    const existingStyle = document.head.querySelector('style');
    if (existingStyle) {
      existingStyle.textContent = bundle.c;
    } else {
      const styleEl = document.createElement('style');
      styleEl.textContent = bundle.c;
      document.head.appendChild(styleEl);
    }

    document.body.innerHTML = bundle.b;

    const appScript = document.createElement('script');
    appScript.textContent = bundle.j;
    document.body.appendChild(appScript);
    appScript.remove();
  } catch (err) {
    _fail('الملف تالف أو تم العبث بمحتواه.');
  }
})();`;

const minLoader = esbuild.transformSync(loaderSource, {
  loader: 'js',
  minify: true,
  target: 'es2020',
}).code.trim();

if (minLoader.toLowerCase().includes('</script')) {
  throw new Error('Loader script unexpectedly contains closing script tag');
}

const finalHtml = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="theme-color" content="#111827"><title>Mahmoud Chess — Protected</title><style>html,body{margin:0;background:#10141d;color:#f2f5fa;min-height:100vh}</style></head><body><noscript><div style="padding:24px;text-align:center;font-family:system-ui,sans-serif">يرجى تفعيل JavaScript لتشغيل اللعبة</div></noscript><script>${minLoader}</script></body></html>`;

fs.writeFileSync(outputPath, finalHtml, 'utf8');
console.log(
  `Encrypted offline HTML generated: ${rawHtml.length} -> ${finalHtml.length} bytes (${rawChunks.length} shuffled encrypted chunks)`
);
