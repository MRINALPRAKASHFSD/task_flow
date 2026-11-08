/**
 * TaskFlow — scripts/capture-phase3-3.js
 * Visual verification screenshot generator for Phase 3.3 Notification Center UI.
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
const PORT = 8091;
const CDP_PORT = 9228;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const outputDir = path.join(ROOT_DIR, 'assets', 'screenshots', 'phase3-3');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
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
  { width: 320,  height: 568,  name: '320x568',  mobile: true },
  { width: 375,  height: 812,  name: '375x812',  mobile: true },
  { width: 480,  height: 800,  name: '480x800',  mobile: true },
  { width: 768,  height: 1024, name: '768x1024', mobile: true },
  { width: 1024, height: 768,  name: '1024x768', mobile: false },
  { width: 1440, height: 900,  name: '1440x900', mobile: false },
];

async function seedRichNotifications(cdp) {
  const seedScript = `
    (() => {
      try {
        const ncKey = 'taskflow_notifications_v1';
        const now = Date.now();
        const yesterday = now - 86400000;
        const notifications = [
          {
            id: 'notif-1',
            type: 'due_today',
            title: 'Task Due Today',
            message: 'Complete Quarterly System Architecture Review is scheduled for today.',
            priority: 'high',
            taskId: null,
            timestamp: new Date(now - 300000).toISOString(),
            read: false
          },
          {
            id: 'notif-2',
            type: 'daily_summary',
            title: 'Daily Productivity Briefing',
            message: 'Good morning! You have 3 tasks scheduled for today and 1 overdue task requiring attention.',
            priority: 'medium',
            taskId: null,
            timestamp: new Date(now - 3600000).toISOString(),
            read: false
          },
          {
            id: 'notif-3',
            type: 'overdue',
            title: 'Overdue Task Alert',
            message: 'Review tax documentation & investment portfolio was due yesterday.',
            priority: 'urgent',
            taskId: null,
            timestamp: new Date(now - 7200000).toISOString(),
            read: false
          },
          {
            id: 'notif-4',
            type: 'recommendation',
            title: 'Productivity Recommendation',
            message: 'High completion rate this week (85%). Consider tackling pending high-priority tasks.',
            priority: 'low',
            taskId: null,
            timestamp: new Date(yesterday - 3600000).toISOString(),
            read: true
          },
          {
            id: 'notif-5',
            type: 'due_soon',
            title: 'Upcoming Deadline',
            message: 'Prepare UX presentation for product team is due tomorrow at 17:00.',
            priority: 'medium',
            taskId: null,
            timestamp: new Date(yesterday - 14400000).toISOString(),
            read: true
          }
        ];
        localStorage.setItem(ncKey, JSON.stringify(notifications));
        window.dispatchEvent(new StorageEvent('storage', { key: ncKey, newValue: JSON.stringify(notifications) }));
        return true;
      } catch (e) {
        return false;
      }
    })()
  `;
  await cdp.eval(seedScript);
}

async function main() {
  if (!fs.existsSync(CHROME_PATH)) {
    console.error(`Chrome binary not found at ${CHROME_PATH}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Phase 3.3 screenshot server running at http://127.0.0.1:${PORT}`);

  const userDataDir = path.join('/tmp', `tf-p33-${Date.now()}`);
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

    const themes = ['light', 'dark'];

    for (const theme of themes) {
      for (const vp of VIEWPORTS) {
        const filename = `notification-center-${vp.name}-${theme}.png`;
        const outputPath = path.join(outputDir, filename);

        console.log(`Capturing ${filename} (${vp.width}x${vp.height}, theme=${theme})...`);

        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.mobile,
        });

        // Navigate with seed and modal=notifications
        await cdp.send('Page.navigate', {
          url: `http://127.0.0.1:${PORT}/?seed=1&theme=${theme}&modal=notifications`,
        });

        // Wait for DOM
        await sleep(400);

        // Seed notifications
        await seedRichNotifications(cdp);

        // Ensure panel is open and rendered
        await cdp.eval(`
          (() => {
            const btn = document.getElementById('btn-header-notifications');
            const panel = document.getElementById('notification-center-panel');
            if (panel && !panel.classList.contains('is-open')) {
              btn?.click();
            }
          })()
        `);

        await sleep(350);

        const shot = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
        });

        const buffer = Buffer.from(shot.data, 'base64');
        fs.writeFileSync(outputPath, buffer);
        console.log(`✅ Saved ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
      }
    }

    // Capture an additional shot showing the header entry point closed with unread badge on desktop
    for (const theme of ['light', 'dark']) {
      const filename = `header-bell-badge-desktop-${theme}.png`;
      const outputPath = path.join(outputDir, filename);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send('Page.navigate', {
        url: `http://127.0.0.1:${PORT}/?seed=1&theme=${theme}`,
      });
      await sleep(400);
      await seedRichNotifications(cdp);
      await sleep(200);

      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      const buffer = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ Saved ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
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
  console.error('Fatal error during Phase 3.3 screenshot capture:', err);
  process.exit(1);
});

