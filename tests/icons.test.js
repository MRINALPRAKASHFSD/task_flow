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
