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
  NotificationCenter,
  NotificationCenterUI,
  isNotificationToday,
  STORAGE_KEY_NOTIFICATIONS,
  NOTIFICATION_LIMIT,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  validateNotificationInput,
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
      toggle: (c, force) => {
        const shouldAdd = force !== undefined ? Boolean(force) : !this._classes.has(c);
        if (shouldAdd) this._classes.add(c);
        else this._classes.delete(c);
        return shouldAdd;
      },
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
    const event = {
      type: 'click',
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      _stopped: false,
      preventDefault: () => { event.defaultPrevented = true; },
      stopPropagation: () => { event._stopped = true; },
    };

    let curr = this;
    while (curr) {
      event.currentTarget = curr;
      curr.dispatchEvent(event);
      if (event._stopped) break;
      curr = curr.parentElement;
    }
  }

  get firstChild() {
    return this.children[0] || null;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  contains(node) {
    if (!node) return false;
    if (node === this) return true;
    for (const child of this.children) {
      if (typeof child.contains === 'function' && child.contains(node)) return true;
    }
    return false;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  matches(selector) {
    if (!selector) return false;
    if (selector.startsWith('.')) {
      return this._classes.has(selector.slice(1));
    }
    if (selector.startsWith('[')) {
      const match = selector.match(/\[([a-zA-Z0-9_-]+)(?:="?([^"]*)"?)?\]/);
      if (match) {
        const attr = match[1];
        const val = match[2];
        if (val !== undefined) {
          return this.getAttribute(attr) === val;
        }
        return this.hasAttribute(attr);
      }
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  focus() {
    this.focused = true;
  }

  getBoundingClientRect() {
    return { top: 10, bottom: 46, left: 100, right: 136, width: 36, height: 36 };
  }

  querySelector(selector) {
    const search = (node) => {
      for (const child of node.children) {
        if (typeof child.matches === 'function' && child.matches(selector)) return child;
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    return search(this);
  }

  querySelectorAll(selector) {
    const results = [];
    const search = (node) => {
      for (const child of node.children) {
        if (typeof child.matches === 'function' && child.matches(selector)) {
          results.push(child);
        }
        search(child);
      }
    };
    search(this);
    return results;
  }
}

beforeEach(() => {
  const docListeners = new Map();
  globalThis.document = {
    createElement: (tag) => new MockDOMElement(tag),
    createElementNS: (_ns, tag) => new MockDOMElement(tag),
    createTextNode: (text) => {
      const el = new MockDOMElement('#text');
      el.textContent = String(text);
      return el;
    },
    addEventListener: (event, handler) => {
      if (!docListeners.has(event)) docListeners.set(event, []);
      docListeners.get(event).push(handler);
    },
    removeEventListener: (event, handler) => {
      if (docListeners.has(event)) {
        const list = docListeners.get(event);
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    },
    dispatchEvent: (event) => {
      for (const h of docListeners.get(event.type) || []) h(event);
    },
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

// ─── Notification Storage & Model Tests ───────────────────────────────────────

class MockStorage {
  constructor(shouldThrow = false) {
    this.store = new Map();
    this.shouldThrow = shouldThrow;
  }
  getItem(key) {
    if (this.shouldThrow) throw new Error('Storage access denied');
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    if (this.shouldThrow) throw new Error('QuotaExceededError');
    this.store.set(key, String(value));
  }
  removeItem(key) {
    if (this.shouldThrow) throw new Error('Storage access denied');
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

describe('Notification Data Model & Input Validation', () => {
  test('constants define supported notification types and priorities', () => {
    assert.equal(NOTIFICATION_LIMIT, 100);
    assert.equal(STORAGE_KEY_NOTIFICATIONS, 'taskflow_notifications');
    assert.deepEqual(Array.from(NOTIFICATION_TYPES), [
      'due_soon',
      'overdue',
      'due_today',
      'daily_summary',
      'recommendation',
    ]);
    assert.deepEqual(Array.from(NOTIFICATION_PRIORITIES), ['low', 'medium', 'high']);
  });

  test('validates correct notification records across all supported types', () => {
    for (const type of NOTIFICATION_TYPES) {
      const res = validateNotificationInput({
        type,
        title: `Notification ${type}`,
        message: `Details about ${type}`,
        priority: 'high',
        taskId: 'task-123',
      });
      assert.equal(res.valid, true, `Type ${type} must be valid`);
      assert.ok(res.cleanedRecord);
      assert.equal(res.cleanedRecord.type, type);
      assert.equal(res.cleanedRecord.priority, 'high');
      assert.equal(res.cleanedRecord.taskId, 'task-123');
      assert.equal(res.cleanedRecord.read, false);
      assert.ok(typeof res.cleanedRecord.id === 'string' && res.cleanedRecord.id.length > 0);
    }
  });

  test('rejects non-object or null input', () => {
    assert.equal(validateNotificationInput(null).valid, false);
    assert.equal(validateNotificationInput(undefined).valid, false);
    assert.equal(validateNotificationInput('not an object').valid, false);
    assert.equal(validateNotificationInput([]).valid, false);
  });

  test('rejects unsupported notification types', () => {
    const res = validateNotificationInput({
      type: 'marketing_promo',
      title: 'Promo',
      message: 'Check this out',
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.type);
  });

  test('rejects empty or whitespace-only title and message', () => {
    const res1 = validateNotificationInput({
      type: 'due_soon',
      title: '   ',
      message: 'Valid message',
    });
    assert.equal(res1.valid, false);
    assert.ok(res1.errors.title);

    const res2 = validateNotificationInput({
      type: 'due_soon',
      title: 'Valid title',
      message: '',
    });
    assert.equal(res2.valid, false);
    assert.ok(res2.errors.message);
  });

  test('rejects titles and messages exceeding length bounds', () => {
    const res1 = validateNotificationInput({
      type: 'due_soon',
      title: 'A'.repeat(151),
      message: 'Valid message',
    });
    assert.equal(res1.valid, false);
    assert.ok(res1.errors.title);

    const res2 = validateNotificationInput({
      type: 'due_soon',
      title: 'Valid title',
      message: 'B'.repeat(501),
    });
    assert.equal(res2.valid, false);
    assert.ok(res2.errors.message);
  });

  test('rejects arbitrary HTML tags and script injection (XSS security)', () => {
    const res1 = validateNotificationInput({
      type: 'overdue',
      title: '<script>alert("xss")</script>',
      message: 'Valid message',
    });
    assert.equal(res1.valid, false);
    assert.ok(res1.errors.title);

    const res2 = validateNotificationInput({
      type: 'overdue',
      title: 'Valid title',
      message: 'Hello <img src=x onerror=alert(1)> world',
    });
    assert.equal(res2.valid, false);
    assert.ok(res2.errors.message);
  });

  test('rejects executable URIs in title and message', () => {
    const res1 = validateNotificationInput({
      type: 'recommendation',
      title: 'javascript:alert(1)',
      message: 'Check recommendation',
    });
    assert.equal(res1.valid, false);

    const res2 = validateNotificationInput({
      type: 'recommendation',
      title: 'Recommendation',
      message: 'data:text/html,<script>alert(1)</script>',
    });
    assert.equal(res2.valid, false);
  });

  test('normalizes priority, defaulting omitted priority to medium', () => {
    const res1 = validateNotificationInput({
      type: 'due_today',
      title: 'Standup',
      message: 'Due today at 10:00',
    });
    assert.equal(res1.valid, true);
    assert.equal(res1.cleanedRecord.priority, 'medium');

    const res2 = validateNotificationInput({
      type: 'due_today',
      title: 'Standup',
      message: 'Due today',
      priority: 'low',
    });
    assert.equal(res2.cleanedRecord.priority, 'low');

    const res3 = validateNotificationInput({
      type: 'due_today',
      title: 'Standup',
      message: 'Due today',
      priority: 'invalid-priority',
    });
    assert.equal(res3.valid, false);
    assert.ok(res3.errors.priority);
  });

  test('handles taskId properly, converting empty strings to null', () => {
    const res1 = validateNotificationInput({
      type: 'daily_summary',
      title: 'Morning Briefing',
      message: 'You have 3 tasks today',
      taskId: '   ',
    });
    assert.equal(res1.valid, true);
    assert.equal(res1.cleanedRecord.taskId, null);

    const res2 = validateNotificationInput({
      type: 'daily_summary',
      title: 'Morning Briefing',
      message: 'You have 3 tasks today',
      taskId: 't-999',
    });
    assert.equal(res2.cleanedRecord.taskId, 't-999');
  });

  test('validates timestamp, rejecting non-date strings and defaulting omitted', () => {
    const res1 = validateNotificationInput({
      type: 'due_soon',
      title: 'Title',
      message: 'Msg',
      timestamp: 'not-a-timestamp',
    });
    assert.equal(res1.valid, false);
    assert.ok(res1.errors.timestamp);

    const res2 = validateNotificationInput({
      type: 'due_soon',
      title: 'Title',
      message: 'Msg',
    });
    assert.equal(res2.valid, true);
    assert.ok(typeof res2.cleanedRecord.timestamp === 'string');
    assert.ok(!isNaN(new Date(res2.cleanedRecord.timestamp).getTime()));
  });
});

describe('NotificationCenter — CRUD Operations & Read State', () => {
  let mockStorage;
  let center;

  beforeEach(() => {
    mockStorage = new MockStorage();
    center = new NotificationCenter(mockStorage);
  });

  test('initializes with empty notification history and 0 unread count', () => {
    assert.deepEqual(center.getNotifications(), []);
    assert.equal(center.getUnreadCount(), 0);
  });

  test('addNotification inserts valid record at the beginning (newest first)', () => {
    const n1 = center.addNotification({
      type: 'due_soon',
      title: 'First task',
      message: 'Due soon',
    });
    assert.ok(n1);
    assert.equal(center.getUnreadCount(), 1);

    const n2 = center.addNotification({
      type: 'overdue',
      title: 'Second task',
      message: 'Overdue now',
    });
    assert.ok(n2);
    assert.equal(center.getUnreadCount(), 2);

    const list = center.getNotifications();
    assert.equal(list.length, 2);
    assert.equal(list[0].id, n2.id, 'Newest notification must be first in list');
    assert.equal(list[1].id, n1.id);
  });

  test('addNotification rejects invalid record safely and leaves store unchanged', () => {
    const invalid = center.addNotification({
      type: 'invalid-type',
      title: '',
    });
    assert.equal(invalid, null);
    assert.equal(center.getNotifications().length, 0);
    assert.equal(center.getUnreadCount(), 0);
  });

  test('getNotifications supports filtering by unreadOnly and type', () => {
    const n1 = center.addNotification({ type: 'due_soon', title: 'T1', message: 'M1' });
    const n2 = center.addNotification({ type: 'overdue', title: 'T2', message: 'M2' });
    center.markAsRead(n1.id);

    const all = center.getNotifications();
    assert.equal(all.length, 2);

    const unread = center.getNotifications({ unreadOnly: true });
    assert.equal(unread.length, 1);
    assert.equal(unread[0].id, n2.id);

    const overdueOnly = center.getNotifications({ type: 'overdue' });
    assert.equal(overdueOnly.length, 1);
    assert.equal(overdueOnly[0].id, n2.id);
  });

  test('markAsRead updates target notification, decrements unread count, and returns boolean', () => {
    const n1 = center.addNotification({ type: 'due_soon', title: 'T1', message: 'M1' });
    center.addNotification({ type: 'due_soon', title: 'T2', message: 'M2' });
    assert.equal(center.getUnreadCount(), 2);

    const marked = center.markAsRead(n1.id);
    assert.equal(marked, true);
    assert.equal(center.getUnreadCount(), 1);

    const updated = center.getNotifications().find(n => n.id === n1.id);
    assert.equal(updated.read, true);

    // Marking non-existent ID returns false
    assert.equal(center.markAsRead('non-existent-id'), false);
  });

  test('markAllAsRead marks all notifications as read and returns transition count', () => {
    center.addNotification({ type: 'due_soon', title: 'T1', message: 'M1' });
    center.addNotification({ type: 'overdue', title: 'T2', message: 'M2' });
    center.addNotification({ type: 'due_today', title: 'T3', message: 'M3' });
    assert.equal(center.getUnreadCount(), 3);

    const count = center.markAllAsRead();
    assert.equal(count, 3);
    assert.equal(center.getUnreadCount(), 0);

    // Second call returns 0 since all are already read
    assert.equal(center.markAllAsRead(), 0);
  });

  test('clearNotification removes individual record by ID', () => {
    const n1 = center.addNotification({ type: 'due_soon', title: 'T1', message: 'M1' });
    const n2 = center.addNotification({ type: 'overdue', title: 'T2', message: 'M2' });

    const removed = center.clearNotification(n1.id);
    assert.equal(removed, true);
    assert.equal(center.getNotifications().length, 1);
    assert.equal(center.getNotifications()[0].id, n2.id);

    // Removing non-existent returns false
    assert.equal(center.clearNotification('invalid-id'), false);
  });

  test('clearAllNotifications empties history and clears storage key', () => {
    center.addNotification({ type: 'due_soon', title: 'T1', message: 'M1' });
    center.addNotification({ type: 'overdue', title: 'T2', message: 'M2' });

    assert.equal(center.getNotifications().length, 2);
    center.clearAllNotifications();

    assert.equal(center.getNotifications().length, 0);
    assert.equal(center.getUnreadCount(), 0);
    assert.equal(mockStorage.getItem(STORAGE_KEY_NOTIFICATIONS), null);
  });
});

describe('NotificationCenter — Persistence, Reload & Fault Tolerance', () => {
  test('persists notifications and read state across re-initialization', () => {
    const storage = new MockStorage();
    const center1 = new NotificationCenter(storage);

    const n1 = center1.addNotification({ type: 'due_soon', title: 'Persisted Task', message: 'Due soon' });
    const n2 = center1.addNotification({ type: 'overdue', title: 'Overdue Task', message: 'Overdue' });
    center1.markAsRead(n1.id);

    // Second instance initialized from same storage
    const center2 = new NotificationCenter(storage);
    const list = center2.getNotifications();

    assert.equal(list.length, 2);
    assert.equal(center2.getUnreadCount(), 1);

    const loaded1 = list.find(n => n.id === n1.id);
    const loaded2 = list.find(n => n.id === n2.id);
    assert.equal(loaded1.read, true);
    assert.equal(loaded2.read, false);
  });

  test('recovers safely from corrupt JSON in storage without crashing', () => {
    const storage = new MockStorage();
    storage.setItem(STORAGE_KEY_NOTIFICATIONS, '{"malformed json: broken');

    const center = new NotificationCenter(storage);
    assert.deepEqual(center.getNotifications(), []);
    assert.equal(center.getUnreadCount(), 0);

    // Can still add new notifications normally after corrupt recovery
    const added = center.addNotification({ type: 'due_today', title: 'Recovered', message: 'Working' });
    assert.ok(added);
    assert.equal(center.getNotifications().length, 1);
  });

  test('operates safely in-memory when storage is null', () => {
    const memoryCenter = new NotificationCenter(null);
    assert.deepEqual(memoryCenter.getNotifications(), []);

    const added = memoryCenter.addNotification({ type: 'due_today', title: 'Memory Only', message: 'No storage' });
    assert.ok(added);
    assert.equal(memoryCenter.getUnreadCount(), 1);
    assert.equal(memoryCenter.markAllAsRead(), 1);
    assert.equal(memoryCenter.getUnreadCount(), 0);
    assert.equal(memoryCenter.clearAllNotifications(), true);
  });

  test('handles storage throwing QuotaExceededError or write errors without crashing', () => {
    const faultyStorage = new MockStorage(true);
    const center = new NotificationCenter(faultyStorage);

    // Operations succeed in-memory despite storage throwing errors
    const added = center.addNotification({ type: 'recommendation', title: 'Tip', message: 'Keep going' });
    assert.ok(added);
    assert.equal(center.getNotifications().length, 1);
    assert.equal(center.saveNotifications(), false);
  });
});

describe('NotificationCenter — Capacity & Pruning Retention Policies', () => {
  test('enforces 100-record capacity limit', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);

    for (let i = 1; i <= 105; i++) {
      center.addNotification({
        type: 'due_soon',
        title: `Notification ${i}`,
        message: `Message ${i}`,
      });
    }

    const list = center.getNotifications();
    assert.equal(list.length, 100, 'Notification capacity must be strictly capped at 100');
    // Newest is first
    assert.equal(list[0].title, 'Notification 105');
  });

  test('prunes oldest read records first when capacity is reached', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);

    // Add 100 notifications
    for (let i = 1; i <= 100; i++) {
      center.addNotification({
        type: 'due_soon',
        title: `Task ${i}`,
        message: `Message ${i}`,
      });
    }

    // Mark task 10 (an older record) as read
    const all = center.getNotifications();
    const target = all.find(n => n.title === 'Task 10');
    assert.ok(target);
    center.markAsRead(target.id);

    // Add 101st notification
    center.addNotification({
      type: 'due_soon',
      title: 'Task 101 (Newest)',
      message: 'Newest message',
    });

    const updated = center.getNotifications();
    assert.equal(updated.length, 100);
    assert.equal(updated[0].title, 'Task 101 (Newest)');

    // Task 10 (the read record) should have been pruned first
    const foundTask10 = updated.find(n => n.title === 'Task 10');
    assert.equal(foundTask10, undefined, 'Oldest read record Task 10 should have been pruned');

    // Task 1 (old unread record) should still be retained
    const foundTask1 = updated.find(n => n.title === 'Task 1');
    assert.ok(foundTask1, 'Old unread record Task 1 must be retained over read record');
  });

  test('applies deterministic FIFO retention policy when all 100 records are unread', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);

    // Add 100 unread notifications
    for (let i = 1; i <= 100; i++) {
      center.addNotification({
        type: 'overdue',
        title: `Unread ${i}`,
        message: `Message ${i}`,
      });
    }

    assert.equal(center.getUnreadCount(), 100);

    // Add 101st notification
    center.addNotification({
      type: 'overdue',
      title: 'Unread 101',
      message: 'Message 101',
    });

    const list = center.getNotifications();
    assert.equal(list.length, 100);
    assert.equal(list[0].title, 'Unread 101');

    // The oldest unread record (Unread 1 at the tail) was deterministically dropped
    const foundUnread1 = list.find(n => n.title === 'Unread 1');
    assert.equal(foundUnread1, undefined, 'Oldest unread record must be dropped under FIFO policy');

    // Unread 2 should still be present as the new oldest item
    const foundUnread2 = list.find(n => n.title === 'Unread 2');
    assert.ok(foundUnread2);
  });
});

describe('NotificationCenter — Duplicate Notification Handling', () => {
  test('suppresses identical unread notification for the same task and content', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);

    const first = center.addNotification({
      taskId: 't-1',
      type: 'due_soon',
      title: 'Task 1 Due',
      message: 'Task 1 is due today at 14:00',
    });
    assert.ok(first);
    assert.equal(center.getNotifications().length, 1);

    // Attempting to add identical unread notification is suppressed
    const duplicate = center.addNotification({
      taskId: 't-1',
      type: 'due_soon',
      title: 'Task 1 Due',
      message: 'Task 1 is due today at 14:00',
    });
    assert.equal(duplicate, null, 'Duplicate unread notification must be rejected');
    assert.equal(center.getNotifications().length, 1);
  });

  test('allows re-notifying if previous notification was marked as read', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);

    const first = center.addNotification({
      taskId: 't-1',
      type: 'due_soon',
      title: 'Task 1 Due',
      message: 'Task 1 is due',
    });
    center.markAsRead(first.id);

    // Adding again is allowed because the prior notification was already read/acknowledged
    const second = center.addNotification({
      taskId: 't-1',
      type: 'due_soon',
      title: 'Task 1 Due',
      message: 'Task 1 is due',
    });
    assert.ok(second);
    assert.equal(center.getNotifications().length, 2);
    assert.notEqual(second.id, first.id);
  });

  test('allows notification if content or type differs for the same task', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);

    const n1 = center.addNotification({
      taskId: 't-1',
      type: 'due_soon',
      title: 'Task 1 Due Soon',
      message: 'Due in 2 hours',
    });
    assert.ok(n1);

    // Different type (overdue instead of due_soon)
    const n2 = center.addNotification({
      taskId: 't-1',
      type: 'overdue',
      title: 'Task 1 Overdue',
      message: 'Task is overdue',
    });
    assert.ok(n2);
    assert.equal(center.getNotifications().length, 2);
  });

  test('cross-tab concurrency: syncs latest storage records before adding and prevents overwriting', () => {
    const sharedStorage = new MockStorage();
    const tab1 = new NotificationCenter(sharedStorage);
    const tab2 = new NotificationCenter(sharedStorage);

    tab1.addNotification({
      type: 'due_soon',
      title: 'Tab 1 Notification',
      message: 'Created in tab 1',
    });

    assert.equal(tab1.getNotifications().length, 1);

    // Tab 2 adds a notification; it should re-sync and preserve Tab 1's notification
    tab2.addNotification({
      type: 'due_today',
      title: 'Tab 2 Notification',
      message: 'Created in tab 2',
    });

    const tab2List = tab2.getNotifications();
    assert.equal(tab2List.length, 2);
    assert.ok(tab2List.some(n => n.title === 'Tab 1 Notification'));
    assert.ok(tab2List.some(n => n.title === 'Tab 2 Notification'));
  });

  test('cross-tab concurrency: suppresses duplicate daily_summary notifications on the same calendar day', () => {
    const sharedStorage = new MockStorage();
    const tab1 = new NotificationCenter(sharedStorage);
    const tab2 = new NotificationCenter(sharedStorage);

    const first = tab1.addNotification({
      type: 'daily_summary',
      title: 'Daily Productivity Briefing',
      message: 'Today\'s Briefing: 2 tasks due today.',
      timestamp: '2026-11-05T09:00:00.000Z',
    });
    assert.ok(first);

    // Tab 2 attempts to add another daily_summary on the same calendar date
    const second = tab2.addNotification({
      type: 'daily_summary',
      title: 'Daily Productivity Briefing',
      message: 'Today\'s Briefing: 2 tasks due today.',
      timestamp: '2026-11-05T09:00:01.000Z',
    });
    assert.equal(second, null, 'Duplicate daily summary on the same calendar day must be rejected');
    assert.equal(tab2.getNotifications().length, 1);

    // Another calendar day is permitted
    const nextDay = tab2.addNotification({
      type: 'daily_summary',
      title: 'Daily Productivity Briefing',
      message: 'Today\'s Briefing: all clear.',
      timestamp: '2026-11-06T09:00:00.000Z',
    });
    assert.ok(nextDay);
    assert.equal(tab2.getNotifications().length, 2);
  });

  test('cross-tab concurrency: markAsRead and clearNotification preserve concurrent additions', () => {
    const sharedStorage = new MockStorage();
    const tab1 = new NotificationCenter(sharedStorage);
    const tab2 = new NotificationCenter(sharedStorage);

    const notif1 = tab1.addNotification({
      type: 'due_soon',
      title: 'Task A',
      message: 'Due soon',
    });

    const notif2 = tab2.addNotification({
      type: 'due_soon',
      title: 'Task B',
      message: 'Due soon',
    });

    // Tab 1 marks its notification as read; it should not discard Task B from Tab 2
    tab1.markAsRead(notif1.id);

    const list = tab1.getNotifications();
    assert.equal(list.length, 2);
    assert.ok(list.find(n => n.id === notif1.id).read);
    assert.ok(!list.find(n => n.id === notif2.id).read);
  });
});

// ─── NotificationCenterUI Component Tests ─────────────────────────────────────

function createMockNotificationUIElements() {
  const bellButton = new MockDOMElement('button', { id: 'btn-header-notifications' });
  const badge = new MockDOMElement('span', { id: 'notification-badge' });
  const badgeSr = new MockDOMElement('span', { id: 'notification-badge-sr' });
  const panel = new MockDOMElement('aside', { id: 'notification-center-panel' });
  panel.classList.add('is-hidden');
  const backdrop = new MockDOMElement('div', { id: 'notification-center-backdrop' });
  backdrop.classList.add('is-hidden');
  const listContainer = new MockDOMElement('div', { id: 'notification-list-container' });
  const countPill = new MockDOMElement('span', { id: 'notification-unread-count-pill' });
  const markAllReadBtn = new MockDOMElement('button', { id: 'btn-notifications-mark-all-read' });
  const clearAllBtn = new MockDOMElement('button', { id: 'btn-notifications-clear-all' });
  const closeBtn = new MockDOMElement('button', { id: 'btn-notification-close' });

  const tabAll = new MockDOMElement('button', { id: 'notification-tab-all', 'data-notification-filter': 'all' });
  tabAll.classList.add('is-active');
  const tabUnread = new MockDOMElement('button', { id: 'notification-tab-unread', 'data-notification-filter': 'unread' });
  const tabIntel = new MockDOMElement('button', { id: 'notification-tab-intelligence', 'data-notification-filter': 'intelligence' });
  const filterTabs = [tabAll, tabUnread, tabIntel];

  return {
    bellButton,
    badge,
    badgeSr,
    panel,
    backdrop,
    listContainer,
    countPill,
    filterTabs,
    markAllReadBtn,
    clearAllBtn,
    closeBtn,
  };
}

describe('NotificationCenterUI — Header Bell & Unread Badge', () => {
  test('updates badge correctly: hides at 0, shows exact count, shows 99+ when over 99', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    // 0 unread: badge hidden, text 0
    assert.equal(dom.badge.textContent, '0');
    assert.ok(dom.badge.classList.contains('is-hidden'));
    assert.equal(dom.badgeSr.textContent, '0 unread notifications');
    assert.equal(dom.bellButton.getAttribute('aria-label'), 'Notifications');

    // Add 2 notifications
    center.addNotification({ type: 'due_soon', title: 'Task 1', message: 'Due in 1 hour' });
    center.addNotification({ type: 'overdue', title: 'Task 2', message: 'Task overdue' });
    ui.updateBadge();

    assert.equal(dom.badge.textContent, '2');
    assert.ok(!dom.badge.classList.contains('is-hidden'));
    assert.equal(dom.badgeSr.textContent, '2 unread notifications');
    assert.equal(dom.bellButton.getAttribute('aria-label'), 'Notifications (2 unread)');
    assert.equal(dom.countPill.textContent, '2 unread');

    // Add 100 notifications to exceed 99
    for (let i = 0; i < 98; i++) {
      center.addNotification({
        id: `bulk-${i}`,
        type: 'due_today',
        title: `Task ${i}`,
        message: `Details ${i}`,
      });
    }
    ui.updateBadge();

    assert.equal(center.getUnreadCount(), 100);
    assert.equal(dom.badge.textContent, '99+');
    assert.equal(dom.bellButton.getAttribute('aria-label'), 'Notifications (99+ unread)');
  });
});

describe('NotificationCenterUI — Panel Opening, Closing & Toggle', () => {
  test('toggles panel open and closed via bell button click', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    assert.equal(ui.isOpen, false);
    assert.ok(dom.panel.classList.contains('is-hidden'));
    assert.equal(dom.bellButton.getAttribute('aria-expanded'), 'false');

    // Open via bell click
    dom.bellButton.click();
    assert.equal(ui.isOpen, true);
    assert.ok(!dom.panel.classList.contains('is-hidden'));
    assert.ok(!dom.backdrop.classList.contains('is-hidden'));
    assert.equal(dom.bellButton.getAttribute('aria-expanded'), 'true');
    assert.equal(dom.panel.getAttribute('aria-hidden'), 'false');

    // Close via bell click
    dom.bellButton.click();
    assert.equal(ui.isOpen, false);
    assert.ok(dom.panel.classList.contains('is-hidden'));
    assert.ok(dom.backdrop.classList.contains('is-hidden'));
    assert.equal(dom.bellButton.getAttribute('aria-expanded'), 'false');
    assert.equal(dom.panel.getAttribute('aria-hidden'), 'true');
  });

  test('closes panel via mobile close button and backdrop click', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.open();
    assert.equal(ui.isOpen, true);

    // Close via close button
    dom.closeBtn.click();
    assert.equal(ui.isOpen, false);

    // Re-open and close via backdrop click
    ui.open();
    assert.equal(ui.isOpen, true);
    dom.backdrop.click();
    assert.equal(ui.isOpen, false);
  });
});

describe('NotificationCenterUI — Outside Click & Keyboard Accessibility', () => {
  test('dismisses panel on outside document click', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.open();
    assert.equal(ui.isOpen, true);

    // Click outside on an external container
    const outsideEl = new MockDOMElement('div', { id: 'main-content' });
    globalThis.document.dispatchEvent({
      type: 'click',
      target: outsideEl,
    });

    assert.equal(ui.isOpen, false);
    assert.ok(dom.panel.classList.contains('is-hidden'));
  });

  test('dismisses panel on Escape keydown and focuses bell button', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.open();
    assert.equal(ui.isOpen, true);

    globalThis.document.dispatchEvent({
      type: 'keydown',
      key: 'Escape',
      preventDefault: () => {},
    });

    assert.equal(ui.isOpen, false);
    assert.ok(dom.panel.classList.contains('is-hidden'));
    assert.equal(dom.bellButton.focused, true);
  });
});

describe('NotificationCenterUI — Filter Tabs & Chronological Grouping', () => {
  test('filters notifications by All, Unread, and Intelligence categories', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const notif1 = center.addNotification({ type: 'due_soon', title: 'Due Soon Task', message: 'Msg 1' });
    const notif2 = center.addNotification({ type: 'overdue', title: 'Overdue Task', message: 'Msg 2' });
    const notif3 = center.addNotification({ type: 'daily_summary', title: 'Daily Briefing', message: 'Msg 3' });
    const notif4 = center.addNotification({ type: 'recommendation', title: 'Smart Tip', message: 'Msg 4' });

    // Mark notif2 and notif4 as read
    center.markAsRead(notif2.id);
    center.markAsRead(notif4.id);

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    // 1. All filter: 4 items
    ui.setFilter('all');
    assert.equal(ui.getFilteredNotifications().length, 4);

    // 2. Unread filter: only notif1 and notif3
    ui.setFilter('unread');
    const unreadItems = ui.getFilteredNotifications();
    assert.equal(unreadItems.length, 2);
    assert.ok(unreadItems.some(n => n.id === notif1.id));
    assert.ok(unreadItems.some(n => n.id === notif3.id));

    // 3. Intelligence filter: only notif3 (daily_summary) and notif4 (recommendation)
    ui.setFilter('intelligence');
    const intelItems = ui.getFilteredNotifications();
    assert.equal(intelItems.length, 2);
    assert.ok(intelItems.some(n => n.id === notif3.id));
    assert.ok(intelItems.some(n => n.id === notif4.id));
  });

  test('partitions notifications chronologically into Today and Earlier groups', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const todayISO = new Date().toISOString();
    const earlierISO = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 2 days ago

    center.addNotification({
      type: 'due_today',
      title: 'Due Today Task',
      message: 'Due today',
      timestamp: todayISO,
    });

    center.addNotification({
      type: 'overdue',
      title: 'Old Overdue Task',
      message: 'Overdue 2 days ago',
      timestamp: earlierISO,
    });

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.renderList();

    // Check group titles in listContainer
    const groupTitles = dom.listContainer.children
      .filter(c => c.classList.contains('notification-group-title'))
      .map(c => c.textContent);

    assert.ok(groupTitles.includes('Today'));
    assert.ok(groupTitles.includes('Earlier'));
  });

  test('renders accessible empty state when active filter has no notifications', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.renderList();

    const emptyState = dom.listContainer.children.find(c => c.classList.contains('notification-empty-state'));
    assert.ok(emptyState, 'Empty state must be displayed for empty list');
  });
});

describe('NotificationCenterUI — Notification Interactions', () => {
  test('marks individual notification as read via action button', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    center.addNotification({
      type: 'due_soon',
      title: 'Urgent Task',
      message: 'Due shortly',
    });

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.open();
    assert.equal(center.getUnreadCount(), 1);

    // Click rendered mark-read button inside listContainer
    const markReadBtn = dom.listContainer.querySelector('.notification-mark-read-btn');
    assert.ok(markReadBtn, 'Mark read button must be rendered');
    markReadBtn.click();

    assert.equal(center.getUnreadCount(), 0);
    assert.equal(dom.badge.textContent, '0');
    assert.ok(dom.badge.classList.contains('is-hidden'));
  });

  test('marks all notifications as read via Mark all read button', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    center.addNotification({ type: 'due_soon', title: 'Task 1', message: 'Msg 1' });
    center.addNotification({ type: 'due_soon', title: 'Task 2', message: 'Msg 2' });

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    assert.equal(center.getUnreadCount(), 2);
    dom.markAllReadBtn.click();

    assert.equal(center.getUnreadCount(), 0);
    assert.equal(dom.badge.textContent, '0');
    assert.ok(dom.badge.classList.contains('is-hidden'));
  });

  test('clears individual notification via clear button', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    center.addNotification({
      type: 'due_soon',
      title: 'Clear Me',
      message: 'To be cleared',
    });

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.open();
    assert.equal(center.getNotifications().length, 1);

    // Click rendered clear button inside listContainer
    const clearItemBtn = dom.listContainer.querySelector('.notification-clear-btn');
    assert.ok(clearItemBtn, 'Clear item button must be rendered');
    clearItemBtn.click();

    assert.equal(center.getNotifications().length, 0);
  });

  test('clear all notifications requires confirmation and clears on confirm', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    center.addNotification({ type: 'due_soon', title: 'Task 1', message: 'Msg 1' });

    let confirmPromptShown = false;
    let confirmChoice = false;

    new NotificationCenterUI({
      notificationCenter: center,
      confirmFn: (msg) => {
        confirmPromptShown = true;
        assert.ok(msg.includes('clear all'));
        return confirmChoice;
      },
      ...dom,
    });

    // 1. User cancels confirmation -> nothing cleared
    confirmChoice = false;
    dom.clearAllBtn.click();
    assert.equal(confirmPromptShown, true);
    assert.equal(center.getNotifications().length, 1);

    // 2. User confirms -> cleared
    confirmChoice = true;
    dom.clearAllBtn.click();
    assert.equal(center.getNotifications().length, 0);
    assert.equal(dom.badge.textContent, '0');
  });
});

describe('NotificationCenterUI — Task Navigation & Deleted Tasks', () => {
  test('clicking task-associated notification triggers onNavigateTask and marks read', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    center.addNotification({
      taskId: 'task-target-99',
      type: 'due_soon',
      title: 'Target Task',
      message: 'Review design system',
    });

    let navigatedTaskId = null;

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      onNavigateTask: (taskId) => {
        navigatedTaskId = taskId;
      },
      ...dom,
    });

    ui.open();

    // Click on rendered task link button inside card
    const taskLinkBtn = dom.listContainer.querySelector('.notification-task-link');
    assert.ok(taskLinkBtn, 'Task link button must be rendered');
    taskLinkBtn.click();

    assert.equal(navigatedTaskId, 'task-target-99');
    assert.equal(ui.isOpen, false, 'Panel must close on task navigation');
    assert.equal(center.getNotifications()[0].read, true, 'Notification must be marked as read');
  });

  test('clicking notification for deleted task marks read and does not crash', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    center.addNotification({
      taskId: 'deleted-task-404',
      type: 'overdue',
      title: 'Deleted Task',
      message: 'Task is overdue',
    });

    let toastMessage = '';
    let toastType = '';

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      onNavigateTask: (taskId) => {
        // Simulates app.js handleNavigateToTask when task is not found
        if (taskId === 'deleted-task-404') {
          toastMessage = 'Task no longer exists.';
          toastType = 'warning';
        }
      },
      onToast: (msg, type) => {
        toastMessage = msg;
        toastType = type;
      },
      ...dom,
    });

    ui.open();

    const cardEl = dom.listContainer.querySelector('.notification-item');
    assert.ok(cardEl, 'Notification item card must be rendered');
    cardEl.click();

    assert.equal(toastMessage, 'Task no longer exists.');
    assert.equal(toastType, 'warning');
    assert.equal(center.getNotifications()[0].read, true);
    assert.equal(ui.isOpen, false);
  });
});

describe('NotificationCenterUI — Cross-Tab Synchronization Hook', () => {
  test('syncWithStorage updates badge and re-renders open panel when storage sync fires', () => {
    const sharedStorage = new MockStorage();
    const center = new NotificationCenter(sharedStorage);
    const dom = createMockNotificationUIElements();

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    assert.equal(dom.badge.textContent, '0');

    // Simulate another tab saving a notification to storage
    center.notifications = [
      {
        id: 'external-notif-1',
        type: 'due_soon',
        title: 'Remote Tab Notification',
        message: 'From tab 2',
        priority: 'high',
        taskId: null,
        timestamp: new Date().toISOString(),
        read: false,
      },
    ];

    // Trigger cross-tab sync hook
    ui.syncWithStorage();

    assert.equal(dom.badge.textContent, '1');
    assert.ok(!dom.badge.classList.contains('is-hidden'));
    assert.equal(dom.badgeSr.textContent, '1 unread notification');
  });
});

describe('NotificationCenterUI — Accessibility & ARIA Interaction Hardening', () => {
  test('tablist supports arrow navigation, Home/End and roving tabindex', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    const [tabAll, tabUnread, tabIntel] = dom.filterTabs;

    // Initial state: tabAll is active with tabindex=0, others tabindex=-1
    assert.equal(tabAll.getAttribute('tabindex'), '0');
    assert.equal(tabUnread.getAttribute('tabindex'), '-1');
    assert.equal(tabIntel.getAttribute('tabindex'), '-1');
    assert.equal(tabAll.getAttribute('aria-selected'), 'true');

    // ArrowRight advances to Unread tab
    tabAll.dispatchEvent({
      type: 'keydown',
      key: 'ArrowRight',
      currentTarget: tabAll,
      preventDefault: () => {},
    });
    assert.equal(ui.activeFilter, 'unread');
    assert.equal(tabAll.getAttribute('tabindex'), '-1');
    assert.equal(tabUnread.getAttribute('tabindex'), '0');
    assert.equal(tabUnread.focused, true);
    assert.equal(dom.listContainer.getAttribute('aria-labelledby'), 'notification-tab-unread');

    // ArrowRight advances to Intelligence tab
    tabUnread.dispatchEvent({
      type: 'keydown',
      key: 'ArrowRight',
      currentTarget: tabUnread,
      preventDefault: () => {},
    });
    assert.equal(ui.activeFilter, 'intelligence');
    assert.equal(tabIntel.getAttribute('tabindex'), '0');
    assert.equal(tabIntel.focused, true);

    // ArrowRight wraps around to All tab
    tabIntel.dispatchEvent({
      type: 'keydown',
      key: 'ArrowRight',
      currentTarget: tabIntel,
      preventDefault: () => {},
    });
    assert.equal(ui.activeFilter, 'all');
    assert.equal(tabAll.getAttribute('tabindex'), '0');
    assert.equal(tabAll.focused, true);

    // ArrowLeft wraps backwards to Intelligence tab
    tabAll.dispatchEvent({
      type: 'keydown',
      key: 'ArrowLeft',
      currentTarget: tabAll,
      preventDefault: () => {},
    });
    assert.equal(ui.activeFilter, 'intelligence');
    assert.equal(tabIntel.getAttribute('tabindex'), '0');

    // Home jumps to first tab (All)
    tabIntel.dispatchEvent({
      type: 'keydown',
      key: 'Home',
      currentTarget: tabIntel,
      preventDefault: () => {},
    });
    assert.equal(ui.activeFilter, 'all');
    assert.equal(tabAll.getAttribute('tabindex'), '0');

    // End jumps to last tab (Intelligence)
    tabAll.dispatchEvent({
      type: 'keydown',
      key: 'End',
      currentTarget: tabAll,
      preventDefault: () => {},
    });
    assert.equal(ui.activeFilter, 'intelligence');
    assert.equal(tabIntel.getAttribute('tabindex'), '0');
  });

  test('item action buttons have specific accessible labels referencing notification title', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    center.addNotification({
      id: 'task-notif-1',
      type: 'overdue',
      title: 'Submit Tax Report',
      message: 'Tax report overdue',
      priority: 'high',
    });

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.open();

    const readBtn = dom.listContainer.querySelector('.notification-mark-read-btn');
    assert.ok(readBtn);
    assert.equal(readBtn.getAttribute('aria-label'), 'Mark "Submit Tax Report" as read');

    const clearBtn = dom.listContainer.querySelector('.notification-clear-btn');
    assert.ok(clearBtn);
    assert.equal(clearBtn.getAttribute('aria-label'), 'Dismiss "Submit Tax Report" notification');

    const itemCard = dom.listContainer.querySelector('.notification-item');
    assert.ok(itemCard);
    assert.ok(itemCard.getAttribute('aria-label').includes('Unread.'));
    assert.ok(itemCard.getAttribute('aria-label').includes('Submit Tax Report'));
  });

  test('focus is restored predictably within list upon notification dismissal', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    center.addNotification({ id: 'item-1', type: 'due_soon', title: 'Task A', message: 'Msg A' });
    center.addNotification({ id: 'item-2', type: 'due_soon', title: 'Task B', message: 'Msg B' });

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.open();

    // Dismiss first item
    const clearBtn1 = dom.listContainer.querySelector('.notification-clear-btn');
    assert.ok(clearBtn1);
    clearBtn1.click();

    // Remaining item should have focus restored
    const remainingCard = dom.listContainer.querySelector('.notification-item');
    assert.ok(remainingCard);
    assert.equal(remainingCard.focused, true);
  });

  test('empty state renders role="status" and aria-live="polite"', () => {
    const storage = new MockStorage();
    const center = new NotificationCenter(storage);
    const dom = createMockNotificationUIElements();

    const ui = new NotificationCenterUI({
      notificationCenter: center,
      ...dom,
    });

    ui.open();

    const emptyState = dom.listContainer.querySelector('.notification-empty-state');
    assert.ok(emptyState);
    assert.equal(emptyState.getAttribute('role'), 'status');
    assert.equal(emptyState.getAttribute('aria-live'), 'polite');
  });
});
