/**
 * TaskFlow — utils.js
 * Shared utility helpers.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

/**
 * Generate a time-ordered unique ID using crypto.randomUUID when available,
 * falling back to a timestamp + random suffix combination.
 *
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + 9-char random hex
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 11);
  return `${ts}-${rand}`;
}

/**
 * Return the current ISO 8601 timestamp string.
 *
 * @returns {string}
 */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * Format an ISO date string into a human-readable relative or absolute label.
 *
 * @param {string} isoString
 * @returns {string}
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr  = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr  / 24);

    if (diffSec < 60)  return 'Just now';
    if (diffMin < 60)  return `${diffMin}m ago`;
    if (diffHr  < 24)  return `${diffHr}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7)   return `${diffDay}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return '';
  }
}

/**
 * Normalise a date input (YYYY-MM-DD or ISO string) to a Date object at local midnight.
 *
 * @param {string|Date} dateInput
 * @returns {Date|null}
 */
export function parseLocalDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }
  if (typeof dateInput !== 'string') return null;

  const trimmed = dateInput.trim();
  // Check for YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Validate whether a string is a valid date representation.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isValidDateString(value) {
  if (!value) return false;
  return parseLocalDate(value) !== null;
}

/**
 * Check if a date string falls on the same calendar day as the reference date.
 *
 * @param {string|Date} dateInput
 * @param {Date} [referenceDate]
 * @returns {boolean}
 */
export function isDateToday(dateInput, referenceDate = new Date()) {
  const d = parseLocalDate(dateInput);
  const ref = parseLocalDate(referenceDate);
  if (!d || !ref) return false;
  return d.getTime() === ref.getTime();
}

/**
 * Check if a due date is strictly before today (overdue).
 *
 * @param {string|Date} dateInput
 * @param {Date} [referenceDate]
 * @returns {boolean}
 */
export function isDateOverdue(dateInput, referenceDate = new Date()) {
  const d = parseLocalDate(dateInput);
  const ref = parseLocalDate(referenceDate);
  if (!d || !ref) return false;
  return d.getTime() < ref.getTime();
}

/**
 * Check if a due date is strictly after today (upcoming).
 *
 * @param {string|Date} dateInput
 * @param {Date} [referenceDate]
 * @returns {boolean}
 */
export function isDateUpcoming(dateInput, referenceDate = new Date()) {
  const d = parseLocalDate(dateInput);
  const ref = parseLocalDate(referenceDate);
  if (!d || !ref) return false;
  return d.getTime() > ref.getTime();
}

/**
 * Format a due date for user-facing display with contextual labels.
 *
 * @param {string|Date} dateInput
 * @param {Date} [referenceDate]
 * @returns {string}
 */
export function formatDueDate(dateInput, referenceDate = new Date()) {
  const d = parseLocalDate(dateInput);
  const ref = parseLocalDate(referenceDate);
  if (!d || !ref) return '';

  const diffDays = Math.round((d.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 7) return `In ${diffDays} days`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== ref.getFullYear() ? 'numeric' : undefined });
}

/**
 * Format a full calendar date for the dashboard header.
 * E.g., "Wednesday, April 30, 2026"
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function formatHeaderDate(date = new Date()) {
  try {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (_) {
    return '';
  }
}

/**
 * Return an appropriate time-of-day greeting.
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Escape a string for safe insertion as a text node value.
 * Prefer textContent over innerHTML, but this is provided for
 * cases where a sanitised string must be interpolated.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Debounce a function call.
 *
 * @param {Function} fn
 * @param {number} delay - milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timerId;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Normalise a search query string for comparison.
 *
 * @param {string} str
 * @returns {string}
 */
export function normalise(str) {
  return String(str || '').toLowerCase().trim();
}

/**
 * Clamp a number between min and max (inclusive).
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Return true if the value is a non-empty string after trimming.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Safely set the text content of a DOM element.
 *
 * @param {Element} el
 * @param {string|number} text
 */
export function setText(el, text) {
  if (el) el.textContent = String(text ?? '');
}

/**
 * Focusable element CSS selector for accessible modal dialogs and focus trapping.
 */
export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Return an array of all visible, focusable elements within a container element.
 *
 * @param {Element} container
 * @returns {Element[]}
 */
export function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return [];
  const list = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  return list.filter((el) => {
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  });
}

/**
 * Traps Tab and Shift + Tab keyboard focus inside a modal dialog container.
 *
 * @param {KeyboardEvent} event
 * @param {Element} container
 */
export function trapFocus(event, container) {
  if (!container || event.key !== 'Tab') return;
  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = typeof document !== 'undefined' ? document.activeElement : null;

  if (event.shiftKey) {
    if (active === first || (container.contains && !container.contains(active))) {
      event.preventDefault();
      if (typeof last.focus === 'function') last.focus();
    }
  } else {
    if (active === last || (container.contains && !container.contains(active))) {
      event.preventDefault();
      if (typeof first.focus === 'function') first.focus();
    }
  }
}

