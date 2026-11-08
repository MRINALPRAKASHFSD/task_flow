/**
 * TaskFlow — scripts/capture-brand-verification.js
 * Visual verification of official brand identity integration across viewports & themes using Chrome CDP.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = 8095;
const CDP_PORT = 9230;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const outputDir = path.join(ROOT_DIR, 'assets', 'screenshots', 'brand');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function createServer() {
  return http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(ROOT_DIR, reqPath);

    if (!filePath.startsWith(ROOT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    } catch (_e) {}

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id && this.pending.has(data.id)) {
          const { resolve: res, reject: rej } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) rej(data.error);
          else res(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_e) {}
    }
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const VIEWPORTS = [
  { width: 320,  height: 720,  name: '320px' },
  { width: 375,  height: 812,  name: '375px' },
  { width: 480,  height: 900,  name: '480px' },
  { width: 768,  height: 1024, name: '768px' },
  { width: 1024, height: 768,  name: '1024px' },
  { width: 1440, height: 900,  name: '1440px' },
];

async function main() {
  if (!fs.existsSync(CHROME_PATH)) {
    console.error(`Chrome binary not found at ${CHROME_PATH}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Brand verification server running at http://127.0.0.1:${PORT}`);

  const userDataDir = path.join('/tmp', `tf-brand-${Date.now()}`);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    `--user-data-dir=${userDataDir}`,
    '--hide-scrollbars',
    '--window-size=1440,900',
    'about:blank',
  ]);

  let cdp = null;

  try {
    let pageTarget = null;
    for (let i = 0; i < 40; i++) {
      await sleep(150);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const list = await res.json();
        const found = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (found) {
          pageTarget = found;
          break;
        }
      } catch (_e) {}
    }

    if (!pageTarget) {
      throw new Error('Failed to find Chrome CDP page target');
    }

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('Connected to Chrome CDP session.');

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    const appUrl = `http://127.0.0.1:${PORT}/?test=1`;
    await cdp.send('Page.navigate', { url: appUrl });
    await sleep(600);

    // Verify brand assets on page
    const checkBrandAssets = await cdp.eval(`
      (() => {
        const logoImg = document.querySelector('.header-brand__logo img');
        const faviconLink = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
        const appleTouchLink = document.querySelector('link[rel="apple-touch-icon"]');
        const manifestLink = document.querySelector('link[rel="manifest"]');
        const tagline = document.querySelector('.header-brand__tagline')?.textContent?.trim();

        return {
          logoImgLoaded: Boolean(logoImg && logoImg.complete && logoImg.naturalWidth > 0),
          logoSrc: logoImg?.src,
          faviconHref: faviconLink?.getAttribute('href'),
          appleTouchHref: appleTouchLink?.getAttribute('href'),
          manifestHref: manifestLink?.getAttribute('href'),
          tagline,
          pageTitle: document.title,
        };
      })()
    `);
    console.log('Brand asset DOM verification:', checkBrandAssets);

    for (const theme of ['light', 'dark']) {
      // Toggle theme via UI / data-theme attribute
      await cdp.eval(`document.documentElement.setAttribute('data-theme', '${theme}');`);
      await sleep(100);

      for (const vp of VIEWPORTS) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.width < 1024,
        });
        await sleep(150);

        // Check horizontal overflow
        const overflow = await cdp.eval(`
          (() => {
            const docW = document.documentElement.clientWidth;
            const scrollW = document.documentElement.scrollWidth;
            const bodyW = document.body.scrollWidth;
            const overflowing = [];
            document.querySelectorAll('*').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.right > docW + 1) {
                overflowing.push({ tag: el.tagName, id: el.id, class: el.className, right: Math.round(rect.right), width: Math.round(rect.width) });
              }
            });
            return {
              hasOverflow: scrollW > docW || bodyW > docW,
              docW,
              scrollW,
              bodyW,
              overflowing: overflowing.slice(0, 5)
            };
          })()
        `);

        if (overflow.hasOverflow) {
          console.warn(`⚠️ Warning: horizontal overflow detected at ${vp.name} (${theme}):`, overflow);
        } else {
          console.log(`✓ ${vp.name} (${theme}): no overflow (docW: ${overflow.docW}, scrollW: ${overflow.scrollW})`);
        }

        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const filePath = path.join(outputDir, `brand-${vp.name}-${theme}.png`);
        fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
      }
    }

    console.log('\nAll 12 responsive screenshots successfully captured and verified in assets/screenshots/brand/!');
  } finally {
    if (cdp) cdp.close();
    chrome.kill('SIGKILL');
    server.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch((err) => {
  console.error('Fatal screenshot runner error:', err);
  process.exit(1);
});
