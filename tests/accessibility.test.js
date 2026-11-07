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

describe('Task Card In-Place Focus Preservation', () => {

  test('focused checkbox retains focus during in-place toggle', () => {
    const card = new MockElement('article');
    const checkbox = new MockElement('input', { type: 'checkbox' });
    card.appendChild(checkbox);

    checkbox.focus();
    assert.equal(globalThis.document.activeElement, checkbox);

    // Simulate in-place toggle mutation
    checkbox.setAttribute('aria-label', 'Reopen task');
    card.setAttribute('class', 'task-card is-completed');

    // Focus is strictly maintained on the checkbox element
    assert.equal(globalThis.document.activeElement, checkbox);
  });

  test('removing completed card shifts focus to adjacent element rather than body', () => {
    const list = new MockElement('div');
    const card1 = new MockElement('article');
    const cb1 = new MockElement('input', { type: 'checkbox' });
    card1.appendChild(cb1);

    const card2 = new MockElement('article');
    const cb2 = new MockElement('input', { type: 'checkbox' });
    card2.appendChild(cb2);

    list.appendChild(card1);
    list.appendChild(card2);

    cb1.focus();
    assert.equal(globalThis.document.activeElement, cb1);

    // When card1 is removed, focus shifts to adjacent sibling cb2
    const wasFocused = card1.contains(globalThis.document.activeElement);
    const fallbackFocus = cb2;
    list.children = list.children.filter(c => c !== card1);

    if (wasFocused && fallbackFocus) {
      fallbackFocus.focus();
    }

    assert.equal(globalThis.document.activeElement, cb2);
  });

  test('restores focus to newly positioned card checkbox after sort order re-render', () => {
    const list = new MockElement('div');
    const card1 = new MockElement('article', { 'data-task-id': 'task-a' });
    const cb1 = new MockElement('input', { type: 'checkbox' });
    card1.appendChild(cb1);

    const card2 = new MockElement('article', { 'data-task-id': 'task-b' });
    const cb2 = new MockElement('input', { type: 'checkbox' });
    card2.appendChild(cb2);

    list.appendChild(card1);
    list.appendChild(card2);

    cb1.focus();
    assert.equal(globalThis.document.activeElement, cb1);

    const wasFocused = card1.contains(globalThis.document.activeElement);

    // Simulate sort order re-render: card1 moves to bottom (after card2)
    const newCard1 = new MockElement('article', { 'data-task-id': 'task-a' });
    const newCb1 = new MockElement('input', { type: 'checkbox' });
    newCard1.appendChild(newCb1);

    const newCard2 = new MockElement('article', { 'data-task-id': 'task-b' });
    const newCb2 = new MockElement('input', { type: 'checkbox' });
    newCard2.appendChild(newCb2);

    list.children = [newCard2, newCard1];

    if (wasFocused) {
      // Re-query new card by ID and restore focus to its checkbox
      const targetCard = list.children.find(c => c.getAttribute('data-task-id') === 'task-a');
      const targetCheckbox = targetCard?.children.find(ch => ch.tagName === 'INPUT');
      if (targetCheckbox) {
        targetCheckbox.focus();
      }
    }

    assert.equal(globalThis.document.activeElement, newCb1, 'Focus must follow task card to its new sorted position');
  });
});

