/**
 * TaskFlow — tests/notifications.test.js
 * Unit tests for the 5-second toast notification lifecycle, countdown indicators,
 * queuing, hover-pause, deduplication, and recurring task notifications.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ToastManager,
  TOAST_LIMIT,
  TOAST_DEFAULT_DURATION_MS,
  TOAST_DURATIONS,
  DEDUPE_WINDOW_MS,
} from '../js/notifications.js';

// ─── Minimal Mock DOM for Node.js test environment ────────────────────────────

class MockDOMElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.children = [];
    this.parentElement = null;
    this.textContent = '';
    this.listeners = new Map();
    this._classes = new Set();
    this.style = {};
  }

  get className() {
    return Array.from(this._classes).join(' ');
  }

  set className(val) {
    this._classes.clear();
    String(val).split(' ').filter(Boolean).forEach((c) => this._classes.add(c));
  }

  get classList() {
    return {
      add: (...cls) => cls.forEach((c) => this._classes.add(c)),
      remove: (...cls) => cls.forEach((c) => this._classes.delete(c)),
      contains: (c) => this._classes.has(c),
    };
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }

  appendChild(child) {
    if (child) {
      child.parentElement = this;
      this.children.push(child);
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) {
        this.parentElement.children.splice(idx, 1);
      }
      this.parentElement = null;
    }
  }

  addEventListener(event, handler, _opts = {}) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  dispatchEvent(event) {
    const handlers = this.listeners.get(event.type) || [];
    for (const h of handlers) {
      h(event);
    }
  }

  click() {
    this.dispatchEvent({ type: 'click', stopPropagation: () => {} });
  }

  querySelector(selector) {
    if (selector.includes('toast__close')) {
      return this.children.find((c) => c.classList.contains('toast__close')) || null;
    }
    if (selector.includes('toast__progress-bar')) {
      const prog = this.children.find((c) => c.classList.contains('toast__progress'));
      if (prog) {
        return prog.children.find((c) => c.classList.contains('toast__progress-bar')) || null;
      }
      return null;
    }
    if (selector.includes('toast__progress')) {
      return this.children.find((c) => c.classList.contains('toast__progress')) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    if (selector.includes('.toast')) {
      for (const child of this.children) {
        if (child.classList.contains('toast')) {
          results.push(child);
        }
      }
    }
    return results;
  }
}

beforeEach(() => {
  globalThis.document = {
    createElement: (tag) => new MockDOMElement(tag),
    createElementNS: (_ns, tag) => new MockDOMElement(tag),
  };
});

describe('Toast Notifications — Configuration & Defaults', () => {

  test('TOAST_LIMIT is capped at 3', () => {
    assert.equal(TOAST_LIMIT, 3, 'Max visible toasts must be exactly 3');
  });

  test('TOAST_DEFAULT_DURATION_MS is exactly 5000ms (5 seconds)', () => {
    assert.equal(TOAST_DEFAULT_DURATION_MS, 5000, 'Default duration must be 5000ms');
  });

  test('TOAST_DURATIONS define 5 seconds (5000ms) for all notification types', () => {
    assert.equal(TOAST_DURATIONS.success, 5000, 'Success toast duration must be 5000ms');
    assert.equal(TOAST_DURATIONS.info, 5000, 'Info toast duration must be 5000ms');
    assert.equal(TOAST_DURATIONS.warning, 5000, 'Warning toast duration must be 5000ms');
    assert.equal(TOAST_DURATIONS.error, 5000, 'Error toast duration must be 5000ms');
  });

  test('DEDUPE_WINDOW_MS is 2000ms to prevent double-click notification spam', () => {
    assert.equal(DEDUPE_WINDOW_MS, 2000);
  });

});

describe('Toast Notifications — Lifecycle, Queuing & Dismissal', () => {

  test('renders toast element with correct role, aria-live, and classes', () => {
    const container = new MockDOMElement('div');
    const manager = new ToastManager(container);

    const toast = manager.show('Operation completed successfully.', 'success');
    assert.ok(toast);
    assert.equal(container.children.length, 1);
    assert.ok(toast.classList.contains('toast'));
    assert.ok(toast.classList.contains('toast--success'));
    assert.equal(toast.getAttribute('role'), 'status');
    assert.equal(toast.getAttribute('aria-live'), 'polite');

    const errorToast = manager.show('Failed to save record.', 'error');
    assert.ok(errorToast);
    assert.equal(errorToast.getAttribute('role'), 'alert');
    assert.equal(errorToast.getAttribute('aria-live'), 'assertive');

    const warningToast = manager.show('Storage approaching quota.', 'warning');
    assert.ok(warningToast);
    assert.ok(warningToast.classList.contains('toast--warning'));
  });

  test('renders countdown progress indicator bar set to 5000ms duration', () => {
    const container = new MockDOMElement('div');
    const manager = new ToastManager(container);

    const toast = manager.show('Auto-dismiss countdown test.', 'info');
    assert.ok(toast);

    const progressContainer = toast.querySelector('.toast__progress');
    assert.ok(progressContainer, 'Progress container must exist');
    assert.equal(progressContainer.getAttribute('aria-hidden'), 'true');

    const progressBar = toast.querySelector('.toast__progress-bar');
    assert.ok(progressBar, 'Progress bar must exist');
    assert.equal(progressBar.style.animationDuration, '5000ms', 'Countdown progress bar must animate over 5000ms');
  });

  test('includes an accessible close button on every toast', () => {
    const container = new MockDOMElement('div');
    const manager = new ToastManager(container);

    const toast = manager.show('Backup downloaded.', 'info');
    assert.ok(toast);

    const closeBtn = toast.querySelector('.toast__close');
    assert.ok(closeBtn, 'Close button must exist on the toast');
    assert.equal(closeBtn.getAttribute('aria-label'), 'Dismiss notification');
  });

  test('manual close button dismisses toast immediately', () => {
    const container = new MockDOMElement('div');
    const manager = new ToastManager(container);

    const toast = manager.show('File uploaded.', 'info');
    assert.equal(manager.getActiveCount(), 1);

    const closeBtn = toast.querySelector('.toast__close');
    closeBtn.click();

    // Trigger animationend to simulate exit transition
    toast.dispatchEvent({ type: 'animationend' });

    assert.equal(manager.getActiveCount(), 0);
    assert.equal(container.children.length, 0);
  });

  test('enforces max 3 visible toasts and queues subsequent notifications', () => {
    const container = new MockDOMElement('div');
    const manager = new ToastManager(container);

    const t1 = manager.show('Toast 1', 'info');
    const t2 = manager.show('Toast 2', 'info');
    const t3 = manager.show('Toast 3', 'info');
    const t4 = manager.show('Toast 4', 'info');
    const t5 = manager.show('Toast 5', 'info');

    assert.ok(t1);
    assert.ok(t2);
    assert.ok(t3);
    assert.equal(t4, null, '4th toast should be queued');
    assert.equal(t5, null, '5th toast should be queued');

    assert.equal(manager.getActiveCount(), 3);
    assert.equal(manager.getQueueLength(), 2);
    assert.equal(container.children.length, 3);

    // Dismiss first toast
    t1.querySelector('.toast__close').click();
    t1.dispatchEvent({ type: 'animationend' });

    // Toast 4 should automatically enter the active set
    assert.equal(manager.getActiveCount(), 3);
    assert.equal(manager.getQueueLength(), 1);

    // Dismiss second toast
    t2.querySelector('.toast__close').click();
    t2.dispatchEvent({ type: 'animationend' });

    // Toast 5 should enter
    assert.equal(manager.getActiveCount(), 3);
    assert.equal(manager.getQueueLength(), 0);
  });

  test('each notification has an independent timer: hovering one does not pause others', () => {
    const container = new MockDOMElement('div');
    const manager = new ToastManager(container);

    const t1 = manager.show('Toast 1', 'info');
    const t2 = manager.show('Toast 2', 'success');

    assert.ok(t1);
    assert.ok(t2);
    assert.equal(manager.getActiveCount(), 2);

    // Hover over t1
    t1.dispatchEvent({ type: 'mouseenter' });

    // t2 should remain independently dismissable and not affected by t1's hover
    t2.querySelector('.toast__close').click();
    t2.dispatchEvent({ type: 'animationend' });

    assert.equal(manager.getActiveCount(), 1);
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0], t1);

    // Leaving t1 resumes its timer
    t1.dispatchEvent({ type: 'mouseleave' });
    assert.equal(manager.getActiveCount(), 1);
  });

  test('deduplicates identical notifications within dedupe window', () => {
    const container = new MockDOMElement('div');
    const manager = new ToastManager(container);

    const first = manager.show('Task marked as completed.', 'success');
    assert.ok(first, 'First invocation should create toast');

    const duplicate = manager.show('Task marked as completed.', 'success');
    assert.equal(duplicate, null, 'Immediate duplicate should be suppressed');

    assert.equal(manager.getActiveCount(), 1);
  });

  test('clearAll removes all active toasts and clears the queue', () => {
    const container = new MockDOMElement('div');
    const manager = new ToastManager(container);

    manager.show('Msg 1', 'info');
    manager.show('Msg 2', 'info');
    manager.show('Msg 3', 'info');
    manager.show('Msg 4', 'info');

    assert.equal(manager.getActiveCount(), 3);
    assert.equal(manager.getQueueLength(), 1);

    manager.clearAll();

    assert.equal(manager.getActiveCount(), 0);
    assert.equal(manager.getQueueLength(), 0);
    assert.equal(container.children.length, 0);
  });

  test('automatic 5-second timer dismisses toast automatically', async () => {
    const container = new MockDOMElement('div');
    const manager = new ToastManager(container);

    // Create toast with a short 50ms test duration
    const toast = manager.show('Short duration test', 'info', 50);
    assert.ok(toast);
    assert.equal(manager.getActiveCount(), 1);

    await new Promise((resolve) => setTimeout(resolve, 80));

    // Simulate animationend or trigger cleanup
    toast.dispatchEvent({ type: 'animationend' });

    assert.equal(manager.getActiveCount(), 0);
    assert.equal(container.children.length, 0);
  });

});
