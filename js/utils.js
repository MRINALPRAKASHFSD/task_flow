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
 * Escape a string for safe insertion as a text node value.
 * Prefer textContent over innerHTML, but this is provided for
 * cases where a sanitised string must be interpolated.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
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
  return String(str).toLowerCase().trim();
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
 * @param {string} text
 */
export function setText(el, text) {
  if (el) el.textContent = String(text);
}
