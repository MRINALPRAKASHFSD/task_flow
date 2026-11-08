/**
 * TaskFlow — js/notifications.js
 * Toast Notification & Lifecycle Management Engine.
 *
 * Provides 5-second auto-dismissal, queuing with a maximum visible limit,
 * countdown progress indicators, manual dismissal, hover-pause, timer cleanup,
 * and deduplication.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import {
  createToastSuccessIcon,
  createToastErrorIcon,
  createToastWarningIcon,
  createToastInfoIcon,
  createToastCloseIcon,
  createAlertIcon,
  createClockIcon,
  createCalendarIcon,
  createCheckIcon,
  createCloseIcon,
  createEmptyClipboardIcon,
} from './icons.js';
import { generateId, nowISO, formatDate } from './utils.js';

export const TOAST_LIMIT = 3;
export const TOAST_DEFAULT_DURATION_MS = 5000;

export const TOAST_DURATIONS = Object.freeze({
  success: 5000, // 5 seconds
  info: 5000,    // 5 seconds
  warning: 5000, // 5 seconds
  error: 5000,   // 5 seconds
});

export const DEDUPE_WINDOW_MS = 2000;

/**
 * ToastManager coordinates creation, 5-second auto-dismissal, queuing,
 * countdown progress indicators, hover-pause, and cleanup of toast notifications.
 */
export class ToastManager {
  /**
   * @param {HTMLElement|null} [container=null]
   */
  constructor(container = null) {
    this.container = container;
    this.activeToasts = new Set();
    this.queue = [];
    this.recentToasts = new Map();
  }

  /**
   * Attach or update the container DOM element.
   *
   * @param {HTMLElement|null} container
   */
  setContainer(container) {
    this.container = container;
  }

  /**
   * Display a non-blocking toast notification.
   *
   * @param {string} message - Notification text
   * @param {'success'|'error'|'warning'|'info'} [type='info'] - Severity level
   * @param {number|null} [customDurationMs=null] - Optional override in milliseconds
   * @returns {HTMLElement|null} Created toast element, or null if queued or suppressed
   */
  show(message, type = 'info', customDurationMs = null) {
    if (!message || typeof message !== 'string') return null;
    const cleanMsg = message.trim();
    if (!cleanMsg) return null;

    // Deduplication check: suppress identical toasts within 2 seconds
    const dedupeKey = `${type}:${cleanMsg}`;
    const now = Date.now();
    const lastSeen = this.recentToasts.get(dedupeKey);
    if (typeof lastSeen === 'number' && (now - lastSeen) < DEDUPE_WINDOW_MS) {
      return null;
    }
    this.recentToasts.set(dedupeKey, now);

    // Prune stale entries from recentToasts
    if (this.recentToasts.size > 50) {
      for (const [key, timestamp] of this.recentToasts.entries()) {
        if (now - timestamp > DEDUPE_WINDOW_MS) {
          this.recentToasts.delete(key);
        }
      }
    }

    const durationMs = (typeof customDurationMs === 'number' && customDurationMs > 0)
      ? customDurationMs
      : (TOAST_DURATIONS[type] || TOAST_DEFAULT_DURATION_MS);

    const toastItem = {
      message: cleanMsg,
      type,
      durationMs,
    };

    if (this.activeToasts.size >= TOAST_LIMIT) {
      this.queue.push(toastItem);
      return null;
    }

    return this._renderToast(toastItem);
  }

  /**
   * Internal renderer for an individual toast element.
   *
   * @private
   * @param {{message: string, type: string, durationMs: number}} item
   * @returns {HTMLElement|null}
   */
  _renderToast(item) {
    if (!this.container) return null;

    const { message, type, durationMs } = item;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast__icon';
    iconSpan.setAttribute('aria-hidden', 'true');

    let iconSvg = null;
    if (type === 'success') {
      iconSvg = createToastSuccessIcon(18);
    } else if (type === 'error') {
      iconSvg = createToastErrorIcon(18);
    } else if (type === 'warning') {
      iconSvg = createToastWarningIcon(18);
    } else {
      iconSvg = createToastInfoIcon(18);
    }
    if (iconSvg) iconSpan.appendChild(iconSvg);

    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast__message';
    msgSpan.textContent = message;

    // Accessible close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast__close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');

    const closeIcon = createToastCloseIcon(14);
    if (closeIcon) {
      closeBtn.appendChild(closeIcon);
    } else {
      closeBtn.textContent = '×';
    }

    // Countdown progress indicator
    const progressContainer = document.createElement('div');
    progressContainer.className = 'toast__progress';
    progressContainer.setAttribute('aria-hidden', 'true');

    const progressBar = document.createElement('div');
    progressBar.className = 'toast__progress-bar';
    progressBar.style.animationDuration = `${durationMs}ms`;

    progressContainer.appendChild(progressBar);

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);
    toast.appendChild(progressContainer);

    this.container.appendChild(toast);
    this.activeToasts.add(toast);

    let timerId = null;
    let remainingMs = durationMs;
    let startTime = Date.now();
    let isClosing = false;

    const dismiss = () => {
      if (isClosing) return;
      isClosing = true;

      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }

      toast.classList.add('is-removing');

      let removed = false;
      const cleanup = () => {
        if (removed) return;
        removed = true;
        this.activeToasts.delete(toast);
        if (toast.parentElement) {
          toast.remove();
        }

        // Drain next item from queue if slots are available
        if (this.queue.length > 0 && this.activeToasts.size < TOAST_LIMIT) {
          const nextItem = this.queue.shift();
          this._renderToast(nextItem);
        }
      };

      toast.addEventListener('animationend', cleanup, { once: true });
      // Safety fallback to guarantee element removal even under reduced-motion
      setTimeout(cleanup, 400);
    };

    const startTimer = (ms) => {
      startTime = Date.now();
      remainingMs = ms;
      timerId = setTimeout(dismiss, ms);
    };

    // Pause on hover: only pauses THIS toast's timer and countdown
    toast.addEventListener('mouseenter', () => {
      if (isClosing) return;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      const elapsed = Date.now() - startTime;
      remainingMs = Math.max(1000, remainingMs - elapsed);
    });

    toast.addEventListener('mouseleave', () => {
      if (isClosing) return;
      startTimer(remainingMs);
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });

    const clearImmediately = () => {
      isClosing = true;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (toast.parentElement) {
        toast.remove();
      }
    };

    // Attach programmatic dismiss handle and progress element reference
    toast._dismiss = dismiss;
    toast._clearImmediately = clearImmediately;
    toast._progressBar = progressBar;

    startTimer(durationMs);
    return toast;
  }

  /**
   * Dismiss all active toasts and clear the queue immediately.
   */
  clearAll() {
    this.queue = [];
    this.recentToasts.clear();
    for (const toast of Array.from(this.activeToasts)) {
      if (typeof toast._clearImmediately === 'function') {
        toast._clearImmediately();
      } else {
        if (typeof toast._dismiss === 'function') {
          toast._dismiss();
        }
        if (toast.parentElement) {
          toast.remove();
        }
      }
    }
    this.activeToasts.clear();
  }

  /**
   * Return the count of currently visible toasts.
   *
   * @returns {number}
   */
  getActiveCount() {
    return this.activeToasts.size;
  }

  /**
   * Return the count of queued toasts waiting to be shown.
   *
   * @returns {number}
   */
  getQueueLength() {
    return this.queue.length;
  }
}

// ─── NotificationCenter & Persistent Storage Engine ───────────────────────────

export const STORAGE_KEY_NOTIFICATIONS = 'taskflow_notifications';
export const NOTIFICATION_LIMIT = 100;

export const NOTIFICATION_TYPES = Object.freeze([
  'due_soon',
  'overdue',
  'due_today',
  'daily_summary',
  'recommendation',
]);

export const NOTIFICATION_PRIORITIES = Object.freeze([
  'low',
  'medium',
  'high',
]);

const DISALLOWED_URI_PATTERN = /^(javascript:|data:|vbscript:)/i;
const HTML_TAG_PATTERN = /<[^>]*>/;

/**
 * Validate and clean a notification input record.
 * Rejects entries with HTML tags or executable URIs (XSS safety).
 *
 * @param {object} input
 * @returns {{ valid: boolean, errors: Record<string, string>, cleanedRecord?: object }}
 */
export function validateNotificationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: { input: 'Notification record must be a non-null object.' } };
  }

  const errors = {};

  // Validate type
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  if (!type || !NOTIFICATION_TYPES.includes(type)) {
    errors.type = `Notification type must be one of: ${NOTIFICATION_TYPES.join(', ')}`;
  }

  // Validate title (1-150 chars, no HTML tags, no executable URIs)
  if (typeof input.title !== 'string') {
    errors.title = 'Title must be a string.';
  } else {
    const trimmedTitle = input.title.trim();
    if (trimmedTitle.length === 0) {
      errors.title = 'Title is required.';
    } else if (trimmedTitle.length > 150) {
      errors.title = 'Title must be 150 characters or fewer.';
    } else if (HTML_TAG_PATTERN.test(trimmedTitle) || DISALLOWED_URI_PATTERN.test(trimmedTitle)) {
      errors.title = 'Title must not contain HTML tags or executable URIs.';
    }
  }

  // Validate message (1-500 chars, no HTML tags, no executable URIs)
  if (typeof input.message !== 'string') {
    errors.message = 'Message must be a string.';
  } else {
    const trimmedMessage = input.message.trim();
    if (trimmedMessage.length === 0) {
      errors.message = 'Message is required.';
    } else if (trimmedMessage.length > 500) {
      errors.message = 'Message must be 500 characters or fewer.';
    } else if (HTML_TAG_PATTERN.test(trimmedMessage) || DISALLOWED_URI_PATTERN.test(trimmedMessage)) {
      errors.message = 'Message must not contain HTML tags or executable URIs.';
    }
  }

  // Validate priority (optional, defaults to 'medium')
  let priority = 'medium';
  if (input.priority !== undefined && input.priority !== null) {
    if (typeof input.priority !== 'string' || !NOTIFICATION_PRIORITIES.includes(input.priority.trim().toLowerCase())) {
      errors.priority = `Priority must be one of: ${NOTIFICATION_PRIORITIES.join(', ')}`;
    } else {
      priority = input.priority.trim().toLowerCase();
    }
  }

  // Validate taskId (optional string or null)
  let taskId = null;
  if (input.taskId !== undefined && input.taskId !== null) {
    if (typeof input.taskId === 'string') {
      const trimmedTask = input.taskId.trim();
      taskId = trimmedTask || null;
    } else {
      errors.taskId = 'taskId must be a string or null.';
    }
  }

  // Validate timestamp (optional, defaults to nowISO())
  let timestamp = nowISO();
  if (input.timestamp !== undefined && input.timestamp !== null) {
    if (typeof input.timestamp === 'string') {
      const d = new Date(input.timestamp);
      if (isNaN(d.getTime())) {
        errors.timestamp = 'Invalid ISO timestamp.';
      } else {
        timestamp = d.toISOString();
      }
    } else {
      errors.timestamp = 'Timestamp must be an ISO string.';
    }
  }

  // Validate read (boolean, defaults to false)
  const read = Boolean(input.read);

  // Validate id (optional non-empty string, defaults to generateId())
  let id = '';
  if (input.id !== undefined && input.id !== null) {
    if (typeof input.id === 'string' && input.id.trim()) {
      id = input.id.trim();
    } else {
      errors.id = 'Notification ID must be a non-empty string.';
    }
  } else {
    id = generateId();
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    cleanedRecord: {
      id,
      type,
      title: input.title.trim(),
      message: input.message.trim(),
      priority,
      taskId,
      timestamp,
      read,
    },
  };
}

/**
 * NotificationCenter coordinates persistent notification records, unread counting,
 * read state transitions, storage serialization, and quota pruning.
 */
export class NotificationCenter {
  /**
   * @param {Storage|null} [storage]
   */
  constructor(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    this.storage = storage;
    /** @type {Array<object>} */
    this.notifications = [];
    this._storageListener = null;
    this.loadNotifications();

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._storageListener = (e) => {
        if (e && e.key === STORAGE_KEY_NOTIFICATIONS) {
          this.loadNotifications();
          if (typeof this.onSync === 'function') {
            try {
              this.onSync();
            } catch (_) {}
          }
        }
      };
      window.addEventListener('storage', this._storageListener);
    }
  }

  /**
   * Remove window storage listeners and clean up.
   */
  destroy() {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function' && this._storageListener) {
      window.removeEventListener('storage', this._storageListener);
      this._storageListener = null;
    }
  }

  /**
   * Set or update the active storage provider.
   *
   * @param {Storage|null} storage
   */
  setStorage(storage) {
    this.storage = storage;
    this.loadNotifications();
  }

  /**
   * Load notifications from storage into memory.
   * Cleanses malformed entries and recovers gracefully from corrupt JSON.
   *
   * @returns {Array<object>} Loaded notifications array
   */
  loadNotifications() {
    if (!this.storage) {
      return this.notifications;
    }

    try {
      const raw = this.storage.getItem(STORAGE_KEY_NOTIFICATIONS);
      if (!raw) {
        this.notifications = [];
        return this.notifications;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.notifications = [];
        return this.notifications;
      }

      const validated = [];
      for (const item of parsed) {
        const { valid, cleanedRecord } = validateNotificationInput(item);
        if (valid && cleanedRecord) {
          validated.push(cleanedRecord);
        }
      }

      this.notifications = validated.slice(0, NOTIFICATION_LIMIT);
      return this.notifications;
    } catch (_) {
      // Corrupt JSON or storage read failure — fail-safe recovery to empty list
      this.notifications = [];
      return this.notifications;
    }
  }

  /**
   * Persist current notifications to storage.
   *
   * @returns {boolean} Whether write succeeded
   */
  saveNotifications() {
    if (!this.storage) {
      return false;
    }

    try {
      this.storage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(this.notifications));
      return true;
    } catch (_) {
      // Handles QuotaExceededError or security restrictions gracefully
      return false;
    }
  }

  /**
   * Add a validated notification to the store.
   * Pre-pends the notification (newest first).
   * Enforces 100-record capacity limit with deterministic pruning:
   * 1. Oldest read records are pruned first.
   * 2. If all records are unread, deterministic FIFO drops the oldest unread record.
   *
   * @param {object} input
   * @returns {object|null} Created notification record, or null if invalid or duplicate
   */
  addNotification(input) {
    const { valid, cleanedRecord } = validateNotificationInput(input);
    if (!valid || !cleanedRecord) {
      return null;
    }

    // Always re-sync latest storage state before evaluating deduplication and prepending
    this.loadNotifications();

    // Duplicate detection: suppress identical unread notification for the same task, type, and message
    // Also enforce at most 1 daily_summary notification per local calendar day
    const recordDate = (cleanedRecord.timestamp || '').slice(0, 10);
    const isDuplicate = this.notifications.some(n => {
      if (cleanedRecord.type === 'daily_summary' && n.type === 'daily_summary') {
        const existingDate = (n.timestamp || '').slice(0, 10);
        if (existingDate && recordDate && existingDate === recordDate) {
          return true;
        }
      }
      return !n.read &&
        n.taskId === cleanedRecord.taskId &&
        n.type === cleanedRecord.type &&
        n.title === cleanedRecord.title &&
        n.message === cleanedRecord.message;
    });
    if (isDuplicate) {
      return null;
    }

    // Capacity limit enforcement (100 records max)
    if (this.notifications.length >= NOTIFICATION_LIMIT) {
      // Step 1: Prune oldest read record (searching from tail)
      let pruned = false;
      for (let i = this.notifications.length - 1; i >= 0; i--) {
        if (this.notifications[i].read) {
          this.notifications.splice(i, 1);
          pruned = true;
          break;
        }
      }

      // Step 2: Deterministic Retention Policy when all records are unread
      // Drop the oldest unread record (at the end of the array)
      if (!pruned && this.notifications.length >= NOTIFICATION_LIMIT) {
        this.notifications.pop();
      }
    }

    // Newest notifications first
    this.notifications.unshift(cleanedRecord);
    this.saveNotifications();
    return cleanedRecord;
  }

  /**
   * Retrieve notification records, optionally filtered.
   *
   * @param {{ unreadOnly?: boolean, type?: string }} [filters={}]
   * @returns {Array<object>}
   */
  getNotifications(filters = {}) {
    let result = this.notifications.slice();

    if (filters.unreadOnly) {
      result = result.filter(n => !n.read);
    }

    if (typeof filters.type === 'string' && filters.type.trim()) {
      result = result.filter(n => n.type === filters.type.trim());
    }

    return result;
  }

  /**
   * Return count of unread notifications.
   *
   * @returns {number}
   */
  getUnreadCount() {
    return this.notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
  }

  /**
   * Mark a notification as read by ID.
   *
   * @param {string} id
   * @returns {boolean} Whether notification was found and marked read
   */
  markAsRead(id) {
    if (!id || typeof id !== 'string') return false;
    this.loadNotifications();

    const notif = this.notifications.find(n => n.id === id);
    if (!notif) return false;

    if (!notif.read) {
      notif.read = true;
      this.saveNotifications();
    }
    return true;
  }

  /**
   * Mark all notifications as read.
   *
   * @returns {number} Count of notifications that transitioned from unread to read
   */
  markAllAsRead() {
    this.loadNotifications();
    let changed = 0;
    for (const notif of this.notifications) {
      if (!notif.read) {
        notif.read = true;
        changed++;
      }
    }

    if (changed > 0) {
      this.saveNotifications();
    }
    return changed;
  }

  /**
   * Clear an individual notification by ID.
   *
   * @param {string} id
   * @returns {boolean} Whether record was removed
   */
  clearNotification(id) {
    if (!id || typeof id !== 'string') return false;
    this.loadNotifications();

    const idx = this.notifications.findIndex(n => n.id === id);
    if (idx === -1) return false;

    this.notifications.splice(idx, 1);
    this.saveNotifications();
    return true;
  }

  /**
   * Clear all notification records from memory and storage.
   *
   * @returns {boolean}
   */
  clearAllNotifications() {
    this.notifications = [];
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY_NOTIFICATIONS);
        return true;
      } catch (_) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Check if a timestamp corresponds to today's local calendar day.
 *
 * @param {string|Date} timestamp
 * @param {Date} [referenceDate=new Date()]
 * @returns {boolean}
 */
export function isNotificationToday(timestamp, referenceDate = new Date()) {
  if (!timestamp) return false;
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return false;
    return (
      d.getFullYear() === referenceDate.getFullYear() &&
      d.getMonth() === referenceDate.getMonth() &&
      d.getDate() === referenceDate.getDate()
    );
  } catch (_) {
    return false;
  }
}

/**
 * NotificationCenterUI coordinates the header bell button, unread badge,
 * anchored dropdown / mobile drawer panel, filtering, chronological grouping,
 * interactions, task navigation, and cross-tab synchronization.
 */
export class NotificationCenterUI {
  /**
   * @param {object} options
   * @param {NotificationCenter} options.notificationCenter
   * @param {HTMLElement} options.bellButton
   * @param {HTMLElement} options.badge
   * @param {HTMLElement} [options.badgeSr]
   * @param {HTMLElement} options.panel
   * @param {HTMLElement} [options.backdrop]
   * @param {HTMLElement} options.listContainer
   * @param {HTMLElement} [options.countPill]
   * @param {NodeList|Array<HTMLElement>} [options.filterTabs]
   * @param {HTMLElement} [options.markAllReadBtn]
   * @param {HTMLElement} [options.clearAllBtn]
   * @param {HTMLElement} [options.closeBtn]
   * @param {Function} [options.onNavigateTask]
   * @param {Function} [options.onToast]
   * @param {Function} [options.confirmFn]
   */
  constructor(options = {}) {
    this.notificationCenter = options.notificationCenter || null;
    this.bellButton = options.bellButton || null;
    this.badge = options.badge || null;
    this.badgeSr = options.badgeSr || null;
    this.panel = options.panel || null;
    this.backdrop = options.backdrop || null;
    this.listContainer = options.listContainer || null;
    this.countPill = options.countPill || null;
    this.filterTabs = options.filterTabs || [];
    this.markAllReadBtn = options.markAllReadBtn || null;
    this.clearAllBtn = options.clearAllBtn || null;
    this.closeBtn = options.closeBtn || null;
    this.onNavigateTask = typeof options.onNavigateTask === 'function' ? options.onNavigateTask : null;
    this.onToast = typeof options.onToast === 'function' ? options.onToast : null;
    this.confirmFn = typeof options.confirmFn === 'function'
      ? options.confirmFn
      : (typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm.bind(window) : () => true);

    this.isOpen = false;
    this.activeFilter = 'all'; // 'all' | 'unread' | 'intelligence'

    this._boundHandleDocumentClick = this._handleDocumentClick.bind(this);
    this._boundHandleDocumentKeydown = this._handleDocumentKeydown.bind(this);

    if (this.bellButton) {
      this.bellButton.setAttribute('aria-expanded', 'false');
    }
    if (this.panel) {
      this.panel.setAttribute('aria-hidden', 'true');
    }

    if (this.filterTabs && this.filterTabs.length > 0) {
      this.filterTabs.forEach((tab) => {
        const f = tab.getAttribute('data-notification-filter');
        const isActive = f === this.activeFilter;
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    this._bindEvents();
    this.updateBadge();

    // Hook cross-tab storage sync
    if (this.notificationCenter) {
      this.notificationCenter.onSync = () => {
        this.syncWithStorage();
      };
    }
  }

  _bindEvents() {
    if (this.bellButton) {
      this.bellButton.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        this.toggle();
      });
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        this.close(true);
      });
    }

    if (this.backdrop) {
      this.backdrop.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        this.close(true);
      });
    }

    if (this.filterTabs && this.filterTabs.length > 0) {
      this.filterTabs.forEach((tab) => {
        tab.addEventListener('click', (e) => {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          const target = e.currentTarget || tab;
          const filter = target.getAttribute('data-notification-filter') || 'all';
          this.setFilter(filter);
        });

        tab.addEventListener('keydown', (e) => {
          const tabs = Array.from(this.filterTabs);
          const currentIndex = tabs.indexOf(e.currentTarget || tab);
          if (currentIndex === -1) return;

          let nextIndex = -1;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % tabs.length;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          } else if (e.key === 'Home') {
            nextIndex = 0;
          } else if (e.key === 'End') {
            nextIndex = tabs.length - 1;
          }

          if (nextIndex !== -1) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            const nextTab = tabs[nextIndex];
            if (nextTab) {
              const nextFilter = nextTab.getAttribute('data-notification-filter') || 'all';
              this.setFilter(nextFilter);
              if (typeof nextTab.focus === 'function') {
                nextTab.focus();
              }
            }
          }
        });
      });
    }

    if (this.markAllReadBtn) {
      this.markAllReadBtn.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        this.handleMarkAllRead();
      });
    }

    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        this.handleClearAll();
      });
    }

    if (this.listContainer) {
      this.listContainer.addEventListener('click', (e) => {
        this._handleListClick(e);
      });
    }
  }

  updateBadge() {
    if (!this.notificationCenter) return;
    const count = this.notificationCenter.getUnreadCount();

    if (this.badge) {
      if (count <= 0) {
        this.badge.textContent = '0';
        this.badge.classList.add('is-hidden');
      } else {
        const displayVal = count > 99 ? '99+' : String(count);
        this.badge.textContent = displayVal;
        this.badge.classList.remove('is-hidden');
      }
    }

    if (this.badgeSr) {
      this.badgeSr.textContent = count === 0
        ? '0 unread notifications'
        : `${count} unread notification${count === 1 ? '' : 's'}`;
    }

    if (this.bellButton) {
      const displayVal = count > 99 ? '99+' : String(count);
      this.bellButton.setAttribute(
        'aria-label',
        count > 0 ? `Notifications (${displayVal} unread)` : 'Notifications'
      );
    }

    if (this.countPill) {
      if (count <= 0) {
        this.countPill.textContent = '0 unread';
        this.countPill.classList.add('is-hidden');
      } else {
        const displayVal = count > 99 ? '99+' : String(count);
        this.countPill.textContent = `${displayVal} unread`;
        this.countPill.classList.remove('is-hidden');
      }
    }
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    if (this.bellButton) {
      this.bellButton.setAttribute('aria-expanded', 'true');
    }

    if (this.panel) {
      this.panel.classList.remove('is-hidden');
      this.panel.setAttribute('aria-hidden', 'false');
    }

    if (this.backdrop) {
      this.backdrop.classList.remove('is-hidden');
    }

    this.positionPanel();
    this.renderList();

    if (typeof document !== 'undefined') {
      document.addEventListener('click', this._boundHandleDocumentClick);
      document.addEventListener('keydown', this._boundHandleDocumentKeydown);
    }

    // Move focus into the panel for keyboard accessibility
    const activeTab = Array.from(this.filterTabs).find(t => t.getAttribute('data-notification-filter') === this.activeFilter);
    if (activeTab && typeof activeTab.focus === 'function') {
      activeTab.focus();
    } else if (this.panel && typeof this.panel.focus === 'function') {
      this.panel.focus();
    }
  }

  close(restoreFocus = true) {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.bellButton) {
      this.bellButton.setAttribute('aria-expanded', 'false');
    }

    if (this.panel) {
      this.panel.classList.add('is-hidden');
      this.panel.setAttribute('aria-hidden', 'true');
    }

    if (this.backdrop) {
      this.backdrop.classList.add('is-hidden');
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this._boundHandleDocumentClick);
      document.removeEventListener('keydown', this._boundHandleDocumentKeydown);
    }

    if (restoreFocus && this.bellButton && typeof this.bellButton.focus === 'function') {
      this.bellButton.focus();
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close(true);
    } else {
      this.open();
    }
  }

  positionPanel() {
    if (typeof window === 'undefined' || !this.panel || !this.bellButton) return;
    if (window.innerWidth >= 768) {
      try {
        if (typeof this.bellButton.getBoundingClientRect === 'function') {
          const rect = this.bellButton.getBoundingClientRect();
          const rightOffset = Math.max(16, window.innerWidth - rect.right - 8);
          this.panel.style.top = `${rect.bottom + 8}px`;
          this.panel.style.right = `${rightOffset}px`;
        }
      } catch (_) {}
    } else {
      this.panel.style.top = '';
      this.panel.style.right = '';
    }
  }

  setFilter(filter) {
    this.activeFilter = filter;

    if (this.filterTabs && this.filterTabs.length > 0) {
      this.filterTabs.forEach((tab) => {
        const f = tab.getAttribute('data-notification-filter');
        const isActive = f === filter;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
      });
    }

    if (this.listContainer) {
      this.listContainer.setAttribute('aria-labelledby', `notification-tab-${filter}`);
    }

    this.renderList();
  }

  getFilteredNotifications() {
    if (!this.notificationCenter) return [];
    let items = this.notificationCenter.getNotifications();

    if (this.activeFilter === 'unread') {
      items = items.filter(n => !n.read);
    } else if (this.activeFilter === 'intelligence') {
      items = items.filter(n => n.type === 'daily_summary' || n.type === 'recommendation');
    }

    return items;
  }

  renderList() {
    if (!this.listContainer) return;
    while (this.listContainer.firstChild) {
      this.listContainer.removeChild(this.listContainer.firstChild);
    }

    const items = this.getFilteredNotifications();

    if (items.length === 0) {
      const emptyWrap = document.createElement('div');
      emptyWrap.className = 'notification-empty-state';
      emptyWrap.setAttribute('role', 'status');
      emptyWrap.setAttribute('aria-live', 'polite');
      emptyWrap.setAttribute('tabindex', '0');

      const iconWrap = document.createElement('div');
      iconWrap.className = 'notification-empty-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      const emptyIcon = createEmptyClipboardIcon(24);
      if (emptyIcon) iconWrap.appendChild(emptyIcon);
      emptyWrap.appendChild(iconWrap);

      const title = document.createElement('div');
      title.className = 'notification-empty-title';
      title.textContent = this.activeFilter === 'unread' ? 'No unread notifications' : 'No notifications yet';
      emptyWrap.appendChild(title);

      const desc = document.createElement('div');
      desc.className = 'notification-empty-desc';
      desc.textContent = this.activeFilter === 'unread'
        ? "You're all caught up! Great job staying on top of your schedule."
        : 'Smart alerts, reminders, and daily briefings will appear here.';
      emptyWrap.appendChild(desc);

      this.listContainer.appendChild(emptyWrap);
      return;
    }

    // Partition chronologically into Today and Earlier
    const now = new Date();
    const todayItems = [];
    const earlierItems = [];

    for (const item of items) {
      if (isNotificationToday(item.timestamp, now)) {
        todayItems.push(item);
      } else {
        earlierItems.push(item);
      }
    }

    if (todayItems.length > 0) {
      this._renderGroup('Today', todayItems);
    }

    if (earlierItems.length > 0) {
      this._renderGroup('Earlier', earlierItems);
    }
  }

  _renderGroup(titleText, groupItems) {
    const groupTitle = document.createElement('div');
    groupTitle.className = 'notification-group-title';
    groupTitle.textContent = titleText;
    this.listContainer.appendChild(groupTitle);

    const group = document.createElement('div');
    group.className = 'notification-group';
    group.setAttribute('role', 'list');

    for (const item of groupItems) {
      const card = this._createItemElement(item);
      group.appendChild(card);
    }

    this.listContainer.appendChild(group);
  }

  _createItemElement(n) {
    const card = document.createElement('article');
    card.className = `notification-item${n.read ? '' : ' notification-item--unread'}`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-notification-id', n.id);
    if (n.taskId) {
      card.setAttribute('data-task-id', n.taskId);
    }

    const priorityLabel = n.priority ? `Priority: ${n.priority}. ` : '';
    const readLabel = !n.read ? 'Unread. ' : '';
    card.setAttribute('aria-label', `${readLabel}${priorityLabel}${n.title || 'Notification'}. ${n.message || ''}`);

    // Unread indicator dot
    if (!n.read) {
      const dot = document.createElement('span');
      dot.className = 'notification-item__dot';
      dot.setAttribute('aria-hidden', 'true');
      card.appendChild(dot);
    }

    // Icon wrap
    const iconWrap = document.createElement('div');
    iconWrap.className = `notification-icon-wrap notification-icon-wrap--${n.type || 'info'}`;
    iconWrap.setAttribute('aria-hidden', 'true');
    const typeIcon = this._createTypeIcon(n.type);
    if (typeIcon) iconWrap.appendChild(typeIcon);
    card.appendChild(iconWrap);

    // Content container
    const content = document.createElement('div');
    content.className = 'notification-item__content';

    const header = document.createElement('div');
    header.className = 'notification-item__header';

    const title = document.createElement('span');
    title.className = 'notification-item__title';
    if (!n.read) {
      const unreadSr = document.createElement('span');
      unreadSr.className = 'sr-only';
      unreadSr.textContent = 'Unread: ';
      title.appendChild(unreadSr);
    }
    const titleText = typeof document.createTextNode === 'function'
      ? document.createTextNode(n.title || 'Notification')
      : (() => { const s = document.createElement('span'); s.textContent = n.title || 'Notification'; return s; })();
    title.appendChild(titleText);
    header.appendChild(title);

    const time = document.createElement('time');
    time.className = 'notification-item__time';
    time.textContent = formatDate(n.timestamp);
    header.appendChild(time);

    content.appendChild(header);

    const message = document.createElement('p');
    message.className = 'notification-item__message';
    message.textContent = n.message || '';
    content.appendChild(message);

    // Task navigation tag button
    if (n.taskId) {
      const taskBtn = document.createElement('button');
      taskBtn.type = 'button';
      taskBtn.className = 'notification-task-link';
      taskBtn.setAttribute('data-action', 'navigate-task');
      taskBtn.setAttribute('data-task-id', n.taskId);
      taskBtn.textContent = 'View Task →';
      content.appendChild(taskBtn);
    }

    card.appendChild(content);

    // Item Action Buttons
    const actions = document.createElement('div');
    actions.className = 'notification-item__actions';

    const notifTitle = n.title || 'Notification';
    if (!n.read) {
      const readBtn = document.createElement('button');
      readBtn.type = 'button';
      readBtn.className = 'notification-action-btn notification-mark-read-btn';
      readBtn.setAttribute('data-action', 'mark-read');
      readBtn.setAttribute('data-id', n.id);
      readBtn.setAttribute('aria-label', `Mark "${notifTitle}" as read`);
      readBtn.setAttribute('title', `Mark "${notifTitle}" as read`);
      const checkIcon = createCheckIcon(14);
      if (checkIcon) readBtn.appendChild(checkIcon);
      actions.appendChild(readBtn);
    }

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'notification-action-btn notification-clear-btn';
    clearBtn.setAttribute('data-action', 'clear-item');
    clearBtn.setAttribute('data-id', n.id);
    clearBtn.setAttribute('aria-label', `Dismiss "${notifTitle}" notification`);
    clearBtn.setAttribute('title', `Dismiss "${notifTitle}" notification`);
    const closeIcon = createCloseIcon(14);
    if (closeIcon) clearBtn.appendChild(closeIcon);
    actions.appendChild(clearBtn);

    card.appendChild(actions);

    return card;
  }

  _createTypeIcon(type) {
    switch (type) {
      case 'overdue':
        return createAlertIcon(16);
      case 'due_today':
      case 'due_soon':
        return createCalendarIcon(16);
      case 'daily_summary':
      case 'recommendation':
      default:
        return createClockIcon(16);
    }
  }

  _handleListClick(e) {
    if (!e || !e.target) return;
    const target = e.target;

    const findClosest = (el, predicate) => {
      let curr = el;
      while (curr && curr !== this.listContainer) {
        if (predicate(curr)) return curr;
        curr = curr.parentElement;
      }
      return null;
    };

    const actionBtn = typeof target.closest === 'function'
      ? target.closest('[data-action]')
      : findClosest(target, el => el.getAttribute && el.getAttribute('data-action'));

    if (actionBtn) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      const action = actionBtn.getAttribute('data-action');
      const id = actionBtn.getAttribute('data-id');

      if (action === 'mark-read' && id) {
        this.notificationCenter.markAsRead(id);
        this.updateBadge();
        this.renderList();
        return;
      }

      if (action === 'clear-item' && id) {
        this.notificationCenter.clearNotification(id);
        this.updateBadge();
        this.renderList();

        // Restore focus predictably within the list so it does not drop to document.body
        if (this.listContainer) {
          const nextTarget = (typeof this.listContainer.querySelector === 'function' &&
            (this.listContainer.querySelector('[data-notification-id]') ||
             this.listContainer.querySelector('.notification-empty-state'))) ||
            this.panel;
          if (nextTarget && typeof nextTarget.focus === 'function') {
            nextTarget.focus();
          }
        }
        return;
      }

      if (action === 'navigate-task') {
        const taskId = actionBtn.getAttribute('data-task-id');
        const notifCard = typeof actionBtn.closest === 'function'
          ? actionBtn.closest('[data-notification-id]')
          : findClosest(actionBtn, el => el.getAttribute && el.getAttribute('data-notification-id'));
        const notifId = notifCard ? notifCard.getAttribute('data-notification-id') : null;
        if (notifId) {
          this.notificationCenter.markAsRead(notifId);
        }
        this.updateBadge();
        this.close(false);
        if (this.onNavigateTask && taskId) {
          this.onNavigateTask(taskId);
        }
        return;
      }
    }

    // If clicked on notification card body
    const card = typeof target.closest === 'function'
      ? target.closest('[data-notification-id]')
      : findClosest(target, el => el.getAttribute && el.getAttribute('data-notification-id'));

    if (card) {
      const id = card.getAttribute('data-notification-id');
      const taskId = card.getAttribute('data-task-id');

      if (id) {
        this.notificationCenter.markAsRead(id);
        this.updateBadge();
      }

      if (taskId && this.onNavigateTask) {
        this.close();
        this.onNavigateTask(taskId);
      } else {
        this.renderList();
      }
    }
  }

  handleMarkAllRead() {
    if (!this.notificationCenter) return;
    this.notificationCenter.markAllAsRead();
    this.updateBadge();
    this.renderList();
  }

  handleClearAll() {
    if (!this.notificationCenter) return;
    const count = this.notificationCenter.getNotifications().length;
    if (count === 0) return;

    const confirmed = this.confirmFn('Are you sure you want to clear all notifications?');
    if (confirmed) {
      this.notificationCenter.clearAllNotifications();
      this.updateBadge();
      this.renderList();
    }
  }

  syncWithStorage() {
    this.updateBadge();
    if (this.isOpen) {
      this.renderList();
    }
  }

  _handleDocumentClick(e) {
    if (!this.isOpen || !e || !e.target) return;
    const target = e.target;
    const isInsidePanel = this.panel && typeof this.panel.contains === 'function' && this.panel.contains(target);
    const isInsideBell = this.bellButton && typeof this.bellButton.contains === 'function' && this.bellButton.contains(target);

    if (!isInsidePanel && !isInsideBell) {
      this.close(false);
    }
  }

  _handleDocumentKeydown(e) {
    if (!this.isOpen || !e) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      this.close(true);
    }
  }

  destroy() {
    this.close();
    if (this.notificationCenter && this.notificationCenter.onSync === this.syncWithStorage) {
      this.notificationCenter.onSync = null;
    }
  }
}
