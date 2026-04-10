/**
 * TaskFlow — storage.js
 * LocalStorage abstraction layer.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

const STORAGE_KEYS = {
  TASKS: 'taskflow_tasks',
  THEME: 'taskflow_theme',
  FILTER: 'taskflow_filter',
};

/**
 * Safely read a JSON value from localStorage.
 * Returns `defaultValue` on any error (missing key, parse error, unavailable storage).
 *
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
function storageGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch (_err) {
    return defaultValue;
  }
}

/**
 * Safely write a JSON value to localStorage.
 * Returns `true` on success, `false` on failure (quota exceeded, unavailable).
 *
 * @param {string} key
 * @param {*} value
 * @returns {boolean}
 */
function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('[TaskFlow] Failed to write to localStorage:', err);
    return false;
  }
}

/**
 * Safely remove a key from localStorage.
 *
 * @param {string} key
 * @returns {boolean}
 */
function storageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error('[TaskFlow] Failed to remove from localStorage:', err);
    return false;
  }
}

/**
 * Check whether localStorage is available and functional.
 *
 * @returns {boolean}
 */
function storageAvailable() {
  const probe = '__taskflow_probe__';
  try {
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch (_err) {
    return false;
  }
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

/**
 * Load all tasks from localStorage.
 *
 * @returns {import('./tasks.js').Task[]}
 */
export function loadTasks() {
  const tasks = storageGet(STORAGE_KEYS.TASKS, []);
  if (!Array.isArray(tasks)) return [];
  return tasks;
}

/**
 * Persist the full task array to localStorage.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @returns {boolean} Whether the save succeeded.
 */
export function saveTasks(tasks) {
  return storageSet(STORAGE_KEYS.TASKS, tasks);
}

// ─── Theme ────────────────────────────────────────────────────────────────────

/**
 * Load the saved theme preference ('light' | 'dark').
 *
 * @returns {'light'|'dark'}
 */
export function loadTheme() {
  const saved = storageGet(STORAGE_KEYS.THEME, null);
  if (saved === 'dark' || saved === 'light') return saved;
  // Respect OS preference on first visit
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Persist the theme preference.
 *
 * @param {'light'|'dark'} theme
 * @returns {boolean}
 */
export function saveTheme(theme) {
  return storageSet(STORAGE_KEYS.THEME, theme);
}

// ─── Filter ───────────────────────────────────────────────────────────────────

/**
 * Load the last-used filter.
 *
 * @returns {'all'|'pending'|'completed'}
 */
export function loadFilter() {
  const saved = storageGet(STORAGE_KEYS.FILTER, 'all');
  return ['all', 'pending', 'completed'].includes(saved) ? saved : 'all';
}

/**
 * Persist the active filter.
 *
 * @param {'all'|'pending'|'completed'} filter
 * @returns {boolean}
 */
export function saveFilter(filter) {
  return storageSet(STORAGE_KEYS.FILTER, filter);
}

// ─── Storage availability check ───────────────────────────────────────────────

export { storageAvailable, STORAGE_KEYS };
