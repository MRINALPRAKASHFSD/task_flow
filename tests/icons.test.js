/**
 * TaskFlow — tests/icons.test.js
 * Unit tests for SVG icon factory functions and accessibility attributes.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

import {
  createSvg,
  createEditIcon,
  createDeleteIcon,
  createCheckIcon,
  createCalendarIcon,
  createAlertIcon,
  createClockIcon,
  createFlameIcon,
  createSunIcon,
  createMoonIcon,
  createPlusIcon,
  createSearchIcon,
  createCloseIcon,
  createSettingsIcon,
  createToastSuccessIcon,
  createToastErrorIcon,
  createToastInfoIcon,
  createToastWarningIcon,
  createToastCloseIcon,
  createBellIcon,
  createEmptyClipboardIcon,
  createPriorityDot,
} from '../js/icons.js';

// ─── Minimal Mock SVG DOM for Node test runner ────────────────────────────────

class MockSvgElement {
  constructor(tagName = 'svg') {
    this.tagName = tagName;
    this.attributes = {};
    this.children = [];
    this._classes = new Set();
    this.classList = {
      add: (...clsList) => clsList.forEach((c) => this._classes.add(c)),
      contains: (c) => this._classes.has(c),
    };
  }

  get className() {
    return Array.from(this._classes).join(' ');
  }

  set className(val) {
    this._classes.clear();
    String(val).split(' ').filter(Boolean).forEach((c) => this._classes.add(c));
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

describe('SVG Icon Factory', () => {

  test('gracefully handles headless environment without document', () => {
    const origDoc = globalThis.document;
    try {
      delete globalThis.document;
      assert.equal(createSvg(), null);
      assert.equal(createEditIcon(), null);
      assert.equal(createPriorityDot(), null);
    } finally {
      globalThis.document = origDoc;
    }
  });

  test('creates accessible SVG elements when document is available', () => {
    globalThis.document = {
      createElementNS: (_ns, tag) => new MockSvgElement(tag),
      createElement: (tag) => new MockSvgElement(tag),
    };

    const icon = createSvg(20, 20, '0 0 24 24', 'custom-class');
    assert.ok(icon);
    assert.equal(icon.getAttribute('width'), '20');
    assert.equal(icon.getAttribute('height'), '20');
    assert.equal(icon.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(icon.getAttribute('aria-hidden'), 'true');
    assert.ok(icon.classList.contains('tf-icon'));
    assert.ok(icon.classList.contains('custom-class'));
  });

  test('all icon generators instantiate with default and custom sizes', () => {
    globalThis.document = {
      createElementNS: (_ns, tag) => new MockSvgElement(tag),
      createElement: (tag) => new MockSvgElement(tag),
    };

    const generators = [
      createEditIcon,
      createDeleteIcon,
      createCheckIcon,
      createCalendarIcon,
      createAlertIcon,
      createClockIcon,
      createFlameIcon,
      createSunIcon,
      createMoonIcon,
      createPlusIcon,
      createSearchIcon,
      createCloseIcon,
      createSettingsIcon,
      createToastSuccessIcon,
      createToastErrorIcon,
      createToastInfoIcon,
      createToastWarningIcon,
      createToastCloseIcon,
      createBellIcon,
      createEmptyClipboardIcon,
    ];

    for (const gen of generators) {
      const defaultIcon = gen();
      assert.ok(defaultIcon, `Failed to create icon with ${gen.name}`);
      assert.equal(defaultIcon.getAttribute('aria-hidden'), 'true');

      const sizedIcon = gen(24, 'extra-style');
      assert.equal(sizedIcon.getAttribute('width'), '24');
      assert.ok(sizedIcon.classList.contains('extra-style'));
    }
  });

  test('createPriorityDot creates color-coded semantic dot span', () => {
    globalThis.document = {
      createElement: (tag) => new MockSvgElement(tag),
    };

    const dot = createPriorityDot('high');
    assert.ok(dot);
    assert.equal(dot.getAttribute('aria-hidden'), 'true');
    assert.ok(dot.classList.contains('priority-dot'));
    assert.ok(dot.classList.contains('priority-dot--high'));
  });

});

describe('Official TaskFlow Brand Assets & Identity System', () => {
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ICO_MAGIC = Buffer.from([0x00, 0x00, 0x01, 0x00]);

  const requiredBrandFiles = [
    'taskflow-logo-full.png',
    'taskflow-logo-icon.png',
    'favicon.svg',
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
  ];

  test('all required brand assets exist and are non-empty in assets/icons/', () => {
    for (const file of requiredBrandFiles) {
      const p = path.join(ROOT_DIR, 'assets', 'icons', file);
      assert.ok(fs.existsSync(p), `Missing asset: assets/icons/${file}`);
      const stats = fs.statSync(p);
      assert.ok(stats.size > 0, `Asset is empty: assets/icons/${file}`);
    }
  });

  test('all PNG brand assets have valid PNG magic signature', () => {
    const pngFiles = requiredBrandFiles.filter(f => f.endsWith('.png'));
    for (const file of pngFiles) {
      const p = path.join(ROOT_DIR, 'assets', 'icons', file);
      const buf = fs.readFileSync(p);
      assert.ok(buf.length >= 8, `PNG file too small: ${file}`);
      assert.ok(buf.slice(0, 8).equals(PNG_MAGIC), `Invalid PNG signature for ${file}`);
    }
  });

  test('favicon.ico has valid ICO format header and contains 2 embedded icons', () => {
    const p = path.join(ROOT_DIR, 'assets', 'icons', 'favicon.ico');
    const buf = fs.readFileSync(p);
    assert.ok(buf.length >= 6);
    assert.ok(buf.slice(0, 4).equals(ICO_MAGIC), 'Invalid ICO magic header');
    const count = buf.readUInt16LE(4);
    assert.equal(count, 2, 'ICO must contain 2 icon representations (16x16 and 32x32)');
  });

  test('favicon.svg contains valid SVG markup with official checklist symbol elements', () => {
    const p = path.join(ROOT_DIR, 'assets', 'icons', 'favicon.svg');
    const content = fs.readFileSync(p, 'utf8');
    assert.ok(content.includes('<svg'), 'Missing <svg tag');
    assert.ok(content.includes('polyline'), 'Missing checkmark polyline');
    assert.ok(content.includes('#00F0B8') || content.includes('#22F2D1'), 'Missing teal brand gradient colors');
    assert.ok(content.includes('#FFFFFF'), 'Missing white checkmark color');
  });

  test('manifest.json exists and links to PWA brand icons', () => {
    const manifestPath = path.join(ROOT_DIR, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.short_name, 'TaskFlow');
    assert.ok(manifest.name.includes('TaskFlow'));
    assert.ok(manifest.name.includes('PLAN') || manifest.name.includes('Plan'));
    assert.equal(manifest.theme_color, '#050F18');
    assert.ok(Array.isArray(manifest.icons));
    assert.ok(manifest.icons.some(i => i.sizes === '192x192'));
    assert.ok(manifest.icons.some(i => i.sizes === '512x512'));
  });

  test('index.html properly connects brand metadata, favicons, and manifest', () => {
    const htmlPath = path.join(ROOT_DIR, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.ok(html.includes('assets/icons/favicon.svg'), 'Missing favicon.svg link');
    assert.ok(html.includes('assets/icons/favicon-32x32.png'), 'Missing favicon-32x32.png link');
    assert.ok(html.includes('assets/icons/apple-touch-icon.png'), 'Missing apple-touch-icon link');
    assert.ok(html.includes('manifest.json'), 'Missing manifest link');
    assert.ok(html.includes('content="#050F18"'), 'Missing official brand theme-color');
    assert.ok(html.includes('Plan • Organize • Execute'), 'Missing official tagline in index.html');
    assert.ok(html.includes('brand-text-task'), 'Missing brand wordmark split styling');
    assert.ok(html.includes('brand-text-flow'), 'Missing brand wordmark flow styling');
  });
});
