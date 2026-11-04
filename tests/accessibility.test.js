/**
 * TaskFlow — tests/accessibility.test.js
 * Unit tests for accessibility, modal focus management, and focus trapping.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  FOCUSABLE_SELECTOR,
  getFocusableElements,
  trapFocus,
} from '../js/utils.js';

// ─── Minimal Mock DOM Element for Focus Trapping Tests ───────────────────────

class MockElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.children = [];
    this.parentElement = null;
    this.focused = false;
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  removeAttribute(k) { delete this.attributes[k]; }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  contains(el) {
    if (el === this) return true;
    for (const child of this.children) {
      if (child.contains(el)) return true;
    }
    return false;
  }

  focus() {
    this.focused = true;
    if (typeof globalThis.document !== 'undefined') {
      globalThis.document.activeElement = this;
    }
  }

  matches(selector) {
    // Basic selector matching for test purposes
    if (selector.includes('button:not([disabled])') && this.tagName === 'BUTTON' && !this.hasAttribute('disabled')) return true;
    if (selector.includes('input:not([disabled])') && this.tagName === 'INPUT' && !this.hasAttribute('disabled')) return true;
    if (selector.includes('select:not([disabled])') && this.tagName === 'SELECT' && !this.hasAttribute('disabled')) return true;
    if (selector.includes('textarea:not([disabled])') && this.tagName === 'TEXTAREA' && !this.hasAttribute('disabled')) return true;
    if (selector.includes('[href]') && this.hasAttribute('href')) return true;
    if (selector.includes('[tabindex]:not([tabindex="-1"])') && this.hasAttribute('tabindex') && this.getAttribute('tabindex') !== '-1') return true;
    return false;
  }

  querySelectorAll(sel) {
    const results = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (child.matches(sel)) {
          results.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return results;
  }
}

// ─── Setup Global Document Stub ──────────────────────────────────────────────

beforeEach(() => {
  globalThis.document = {
    activeElement: null,
  };
});

describe('Accessibility & Focus Management', () => {

  test('FOCUSABLE_SELECTOR includes interactive HTML elements', () => {
    assert.ok(FOCUSABLE_SELECTOR.includes('button:not([disabled])'));
    assert.ok(FOCUSABLE_SELECTOR.includes('[href]'));
    assert.ok(FOCUSABLE_SELECTOR.includes('input:not([disabled])'));
    assert.ok(FOCUSABLE_SELECTOR.includes('select:not([disabled])'));
    assert.ok(FOCUSABLE_SELECTOR.includes('textarea:not([disabled])'));
    assert.ok(FOCUSABLE_SELECTOR.includes('[tabindex]:not([tabindex="-1"])'));
  });

  test('getFocusableElements filters out disabled and hidden elements', () => {
    const modal = new MockElement('div');
    const btn1 = new MockElement('button');
    const btnDisabled = new MockElement('button', { disabled: 'true' });
    const btnHidden = new MockElement('button', { 'aria-hidden': 'true' });
    const input1 = new MockElement('input');

    modal.appendChild(btn1);
    modal.appendChild(btnDisabled);
    modal.appendChild(btnHidden);
    modal.appendChild(input1);

    const focusables = getFocusableElements(modal);
    assert.equal(focusables.length, 2);
    assert.equal(focusables[0], btn1);
    assert.equal(focusables[1], input1);
  });

  test('trapFocus cycles Tab from last focusable to first focusable element', () => {
    const modal = new MockElement('div');
    const firstBtn = new MockElement('button');
    const lastBtn = new MockElement('button');
    modal.appendChild(firstBtn);
    modal.appendChild(lastBtn);

    // Active element is the last button
    lastBtn.focus();
    assert.equal(globalThis.document.activeElement, lastBtn);

    let defaultPrevented = false;
    const tabEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: () => { defaultPrevented = true; },
    };

    trapFocus(tabEvent, modal);

    assert.equal(defaultPrevented, true, 'Default Tab navigation should be intercepted');
    assert.equal(globalThis.document.activeElement, firstBtn, 'Focus should wrap to first element');
  });

  test('trapFocus cycles Shift + Tab from first focusable to last focusable element', () => {
    const modal = new MockElement('div');
    const firstBtn = new MockElement('button');
    const lastBtn = new MockElement('button');
    modal.appendChild(firstBtn);
    modal.appendChild(lastBtn);

    // Active element is the first button
    firstBtn.focus();
    assert.equal(globalThis.document.activeElement, firstBtn);

    let defaultPrevented = false;
    const shiftTabEvent = {
      key: 'Tab',
      shiftKey: true,
      preventDefault: () => { defaultPrevented = true; },
    };

    trapFocus(shiftTabEvent, modal);

    assert.equal(defaultPrevented, true, 'Default Shift+Tab navigation should be intercepted');
    assert.equal(globalThis.document.activeElement, lastBtn, 'Focus should wrap to last element');
  });

  test('trapFocus ignores non-Tab keys', () => {
    const modal = new MockElement('div');
    const btn = new MockElement('button');
    modal.appendChild(btn);
    btn.focus();

    let defaultPrevented = false;
    const enterEvent = {
      key: 'Enter',
      shiftKey: false,
      preventDefault: () => { defaultPrevented = true; },
    };

    trapFocus(enterEvent, modal);
    assert.equal(defaultPrevented, false);
  });

  test('trapFocus prevents default when container has no focusables', () => {
    const emptyModal = new MockElement('div');
    let defaultPrevented = false;
    const tabEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: () => { defaultPrevented = true; },
    };

    trapFocus(tabEvent, emptyModal);
    assert.equal(defaultPrevented, true);
  });
});
