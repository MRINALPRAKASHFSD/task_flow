/**
 * TaskFlow — scripts/capture-screenshots.js
 * Automated headless browser screenshot generator for documentation and release verification.
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
const PORT = 8089;
const CDP_PORT = 9226;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const screenshotsDir = path.join(ROOT_DIR, 'assets', 'screenshots');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

function createServer() {
  const server = http.createServer((req, res) => {
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
    } catch (_e) {
      // Not found
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return server;
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

const SCREENSHOT_TARGETS = [
  {
    name: 'desktop-light.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.querySelectorAll(".task-card").length >= 6',
  },
  {
    name: 'desktop-dark.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=dark`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.querySelectorAll(".task-card").length >= 6',
  },
  {
    name: 'mobile-light.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light`,
    width: 375,
    height: 812,
    mobile: true,
    waitFor: () => 'document.querySelectorAll(".task-card").length >= 6',
  },
  {
    name: 'mobile-dark.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=dark`,
    width: 375,
    height: 812,
    mobile: true,
    waitFor: () => 'document.querySelectorAll(".task-card").length >= 6',
  },
  {
    name: 'task-modal.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light&modal=add`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.getElementById("modal-overlay")?.classList.contains("is-open")',
  },
  {
    name: 'settings-modal.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=dark&modal=settings`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.getElementById("settings-overlay")?.classList.contains("is-open")',
  },
  {
    name: 'phase4/dashboard-clean.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.querySelectorAll(".task-card").length >= 6',
  },
  {
    name: 'phase4/dashboard-toast.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light&toast=1`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.querySelectorAll(".toast").length >= 1',
  },
  {
    name: 'phase4/modal-task-desktop.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light&modal=add`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.getElementById("modal-overlay")?.classList.contains("is-open")',
  },
  {
    name: 'phase4/modal-task-mobile.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light&modal=add`,
    width: 375,
    height: 812,
    mobile: true,
    waitFor: () => 'document.getElementById("modal-overlay")?.classList.contains("is-open")',
  },
  {
    name: 'phase4/modal-task-light.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light&modal=add`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.getElementById("modal-overlay")?.classList.contains("is-open")',
  },
  {
    name: 'phase4/modal-settings-dark.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=dark&modal=settings`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.getElementById("settings-overlay")?.classList.contains("is-open")',
  },
  {
    name: 'phase4/viewport-1440x900-light.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.querySelectorAll(".task-card").length >= 6',
  },
  {
    name: 'phase4/viewport-1440x900-dark.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=dark`,
    width: 1440,
    height: 900,
    mobile: false,
    waitFor: () => 'document.querySelectorAll(".task-card").length >= 6',
  },
  {
    name: 'phase4/viewport-375x812-light.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=light`,
    width: 375,
    height: 812,
    mobile: true,
    waitFor: () => 'document.querySelectorAll(".task-card").length >= 6',
  },
  {
    name: 'phase4/viewport-375x812-dark.png',
    url: `http://127.0.0.1:${PORT}/?seed=1&theme=dark`,
    width: 375,
    height: 812,
    mobile: true,
    waitFor: () => 'document.querySelectorAll(".task-card").length >= 6',
  },
];

async function main() {
  if (!fs.existsSync(CHROME_PATH)) {
    console.error(`Chrome binary not found at ${CHROME_PATH}`);
    process.exit(1);
  }

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Local test server running on http://127.0.0.1:${PORT}`);

  const userDataDir = path.join('/tmp', `tf-ss-ud-${Date.now()}`);
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
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    for (const target of SCREENSHOT_TARGETS) {
      const outputPath = path.join(screenshotsDir, target.name);
      console.log(`Capturing ${target.name} (${target.width}x${target.height})...`);

      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: target.width,
        height: target.height,
        deviceScaleFactor: 1,
        mobile: target.mobile,
      });

      await cdp.send('Page.navigate', { url: target.url });

      // Poll for readiness
      const startTime = Date.now();
      let ready = false;
      while (Date.now() - startTime < 6000) {
        await sleep(150);
        try {
          const isReady = await cdp.eval(target.waitFor());
          if (isReady) {
            ready = true;
            break;
          }
        } catch (_e) {}
      }

      if (!ready) {
        console.warn(`Warning: readiness condition not met for ${target.name}, proceeding with capture...`);
      }

      // Small settle delay for CSS transitions/animations
      await sleep(300);

      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });

      const buffer = Buffer.from(shot.data, 'base64');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ Saved ${target.name} (${(buffer.length / 1024).toFixed(1)} KB)`);
    }
  } finally {
    if (cdp) cdp.close();
    chrome.kill('SIGKILL');
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_e) {}
    console.log('Capture complete. Test server closed.');
  }
}

main().catch((err) => {
  console.error('Fatal error during screenshot capture:', err);
  process.exit(1);
});
