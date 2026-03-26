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
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = 8089;

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
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
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

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const screenshotsDir = path.join(ROOT_DIR, 'assets', 'screenshots');

const SCREENSHOT_TARGETS = [
  {
    name: 'desktop-light.png',
    url: `http://localhost:${PORT}/?seed=1&theme=light`,
    width: 1440,
    height: 900,
  },
  {
    name: 'desktop-dark.png',
    url: `http://localhost:${PORT}/?seed=1&theme=dark`,
    width: 1440,
    height: 900,
  },
  {
    name: 'mobile-light.png',
    url: `http://localhost:${PORT}/?seed=1&theme=light`,
    width: 375,
    height: 812,
  },
  {
    name: 'mobile-dark.png',
    url: `http://localhost:${PORT}/?seed=1&theme=dark`,
    width: 375,
    height: 812,
  },
  {
    name: 'task-modal.png',
    url: `http://localhost:${PORT}/?seed=1&theme=light&modal=add`,
    width: 1440,
    height: 900,
  },
  {
    name: 'settings-modal.png',
    url: `http://localhost:${PORT}/?seed=1&theme=dark&modal=settings`,
    width: 1440,
    height: 900,
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
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Local test server running on http://localhost:${PORT}`);

  try {
    for (const target of SCREENSHOT_TARGETS) {
      const outputPath = path.join(screenshotsDir, target.name);
      console.log(`Capturing ${target.name} (${target.width}x${target.height})...`);

      const args = [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        `--window-size=${target.width},${target.height}`,
        `--screenshot=${outputPath}`,
        target.url,
      ];

      const res = spawnSync(CHROME_PATH, args, { encoding: 'utf-8', timeout: 60000 });
      if (res.error) {
        console.error(`Error capturing ${target.name}:`, res.error);
      } else if (fs.existsSync(outputPath)) {
        const bytes = fs.statSync(outputPath).size;
        console.log(`✅ Saved ${target.name} (${(bytes / 1024).toFixed(1)} KB)`);
      } else {
        console.error(`Failed to produce ${target.name}`, res.stderr || res.stdout);
      }
    }
  } finally {
    server.close();
    console.log('Test server closed.');
  }
}

main().catch((err) => {
  console.error('Fatal error during screenshot capture:', err);
  process.exit(1);
});
