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
} from './icons.js';

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
