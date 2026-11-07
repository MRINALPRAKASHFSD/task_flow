/**
 * TaskFlow — storage.js
 * LocalStorage abstraction layer with schema versioning, validation and error handling.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { PRIORITIES } from './tasks.js';

export const CURRENT_SCHEMA_VERSION = 1;

/** Maximum allowable JSON import file size (5 MB) to prevent browser memory exhaustion. */
export const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum allowable task count per import to ensure performant UI rendering and quota safety. */
export const MAX_IMPORT_TASKS_LIMIT = 5000;

export const STORAGE_KEYS = {
  TASKS:   'taskflow_tasks',
  THEME:   'taskflow_theme',
  FILTER:  'taskflow_filter',
  DATA:    'taskflow_data',
};

// In-memory fallback storage used ONLY when localStorage is unavailable or throws errors
const memoryStore = new Map();

/**
 * Diagnostic tracking of last encountered storage error.
 * @type {{ type: 'quota'|'write_error'|'serialization_error'|'unavailable', message: string, key?: string, timestamp: number }|null}
 */
let lastStorageError = null;

/**
 * Inspect whether a thrown storage error is a QuotaExceededError.
 *
 * @param {Error|*} err
 * @returns {boolean}
 */
export function isQuotaError(err) {
  if (!err) return false;
  return err.name === 'QuotaExceededError'
    || err.code === 22
    || err.code === 1014
    || err.number === -2146828281
    || /quota/i.test(err.message || '');
}

/**
 * Retrieve the last captured storage error.
 *
 * @returns {typeof lastStorageError}
 */
export function getLastStorageError() {
  return lastStorageError;
}

/**
 * Reset the last captured storage error.
 */
export function clearLastStorageError() {
  lastStorageError = null;
}

/**
 * Check whether localStorage is available and functional.
 *
 * @returns {boolean}
 */
export function storageAvailable() {
  const probe = '__taskflow_probe__';
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return false;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Safely read a string value from storage.
 *
 * @param {string} key
 * @returns {string|null}
 */
function rawGet(key) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      return localStorage.getItem(key);
    }
  } catch (_e) {
    // localStorage access blocked / unavailable; fall back to memoryStore
  }
  return memoryStore.has(key) ? memoryStore.get(key) : null;
}

/**
 * Safely write a string value to storage.
 *
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
function rawSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      localStorage.setItem(key, value);
      lastStorageError = null;
      return true;
    }
  } catch (err) {
    const quota = isQuotaError(err);
    console.warn('[TaskFlow] localStorage write failed, using in-memory store:', err.message);
    lastStorageError = {
      type: quota ? 'quota' : 'write_error',
      message: err.message,
      key,
      timestamp: Date.now(),
    };
    memoryStore.set(key, value);
    return false;
  }
  lastStorageError = {
    type: 'unavailable',
    message: 'LocalStorage is unavailable or disabled.',
    key,
    timestamp: Date.now(),
  };
  memoryStore.set(key, value);
  return false;
}

/**
 * Safely remove a key from storage.
 *
 * @param {string} key
 * @returns {boolean}
 */
function rawRemove(key) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      localStorage.removeItem(key);
    }
  } catch (_e) {
    // ignore
  }
  memoryStore.delete(key);
  return true;
}

/**
 * Safely read a JSON value from storage.
 * Returns `defaultValue` on any error (missing key, parse error, unavailable storage).
 *
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
function storageGet(key, defaultValue = null) {
  const raw = rawGet(key);
  if (raw === null || raw === undefined) return defaultValue;
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return defaultValue;
  }
}

/**
 * Safely write a JSON value to storage.
 *
 * @param {string} key
 * @param {*} value
 * @returns {boolean}
 */
function storageSet(key, value) {
  try {
    return rawSet(key, JSON.stringify(value));
  } catch (err) {
    console.error('[TaskFlow] Failed to write to localStorage:', err);
    lastStorageError = {
      type: 'serialization_error',
      message: err.message,
      key,
      timestamp: Date.now(),
    };
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
  return rawRemove(key);
}

// ─── Task Validation and Cleansing ────────────────────────────────────────────

/**
 * Validate and cleanse a single loaded task record to ensure data integrity.
 *
 * @param {*} raw
 * @returns {import('./tasks.js').Task|null}
 */
export function validateTaskRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!Object.prototype.hasOwnProperty.call(raw, 'id') || !raw.id || typeof raw.id !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(raw, 'title') || !raw.title || typeof raw.title !== 'string') return null;

  const title = raw.title.trim().slice(0, 200);
  if (!title) return null;

  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 1000) : '';
  const priority = PRIORITIES.includes(raw.priority) ? raw.priority : 'medium';
  const category = typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim().slice(0, 50) : 'General';

  const isCompleted = raw.completed === true || raw.status === 'completed';
  const status = isCompleted ? 'completed' : 'pending';
  const completed = isCompleted;

  let dueDate = null;
  if (typeof raw.dueDate === 'string' && raw.dueDate.trim()) {
    dueDate = raw.dueDate.trim();
  }

  const createdAt = typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : createdAt;

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter(t => typeof t === 'string').map(t => t.replace(/^#/, '').trim().toLowerCase().slice(0, 30)).filter(Boolean)
    : [];

  const subtasks = Array.isArray(raw.subtasks)
    ? raw.subtasks.filter(s => s && typeof s === 'object' && typeof s.title === 'string' && s.title.trim()).map(s => ({
        id: typeof s.id === 'string' && s.id ? s.id : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)),
        title: s.title.trim().slice(0, 200),
        completed: Boolean(s.completed),
      }))
    : [];

  const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 5000) : '';
  const recurrence = (raw.recurrence && typeof raw.recurrence === 'object' && typeof raw.recurrence.type === 'string')
    ? raw.recurrence
    : null;
  const reminderTime = (typeof raw.reminderTime === 'string' && /^(\d{1,2}):(\d{2})$/.test(raw.reminderTime.trim()))
    ? raw.reminderTime.trim()
    : null;

  return {
    id: String(raw.id),
    title,
    description,
    priority,
    category,
    status,
    completed,
    dueDate,
    tags,
    subtasks,
    notes,
    recurrence,
    reminderTime,
    createdAt,
    updatedAt,
  };
}

/**
 * Cleanse an array of task records.
 *
 * @param {Array} list
 * @returns {import('./tasks.js').Task[]}
 */
export function cleanseTaskList(list) {
  if (!Array.isArray(list)) return [];
  const valid = [];
  for (const item of list) {
    const cleansed = validateTaskRecord(item);
    if (cleansed) valid.push(cleansed);
  }
  return valid;
}

// ─── Versioned App State ──────────────────────────────────────────────────────

/**
 * Load the full versioned application state.
 * Automatically migrates unversioned data if present.
 *
 * @returns {{ version: number, tasks: import('./tasks.js').Task[], preferences: { theme: 'light'|'dark', filter: string, sortBy: string, category: string } }}
 */
export function loadAppState() {
  const versioned = storageGet(STORAGE_KEYS.DATA, null);

  if (versioned && typeof versioned === 'object' && Array.isArray(versioned.tasks)) {
    return {
      version: versioned.version || CURRENT_SCHEMA_VERSION,
      tasks: cleanseTaskList(versioned.tasks),
      preferences: {
        theme: versioned.preferences?.theme === 'dark' ? 'dark' : 'light',
        filter: versioned.preferences?.filter || 'all',
        sortBy: versioned.preferences?.sortBy || 'newest',
        category: versioned.preferences?.category || 'all',
      },
    };
  }

  // Fallback to legacy unversioned tasks and theme keys
  const legacyTasksRaw = storageGet(STORAGE_KEYS.TASKS, []);
  const legacyTasks = Array.isArray(legacyTasksRaw) ? cleanseTaskList(legacyTasksRaw) : [];
  const legacyTheme = loadTheme();
  const legacyFilter = loadFilter();

  const state = {
    version: CURRENT_SCHEMA_VERSION,
    tasks: legacyTasks,
    preferences: {
      theme: legacyTheme,
      filter: legacyFilter,
      sortBy: 'newest',
      category: 'all',
    },
  };

  // If legacy tasks were found, save to versioned store
  if (legacyTasks.length > 0) {
    saveAppState(state);
  }

  return state;
}

/**
 * Persist the full versioned application state to storage.
 *
 * @param {{ version?: number, tasks: import('./tasks.js').Task[], preferences?: Object }} state
 * @returns {boolean}
 */
export function saveAppState(state) {
  const payload = {
    version: CURRENT_SCHEMA_VERSION,
    tasks: Array.isArray(state?.tasks) ? state.tasks : [],
    preferences: {
      theme: state?.preferences?.theme === 'dark' ? 'dark' : 'light',
      filter: state?.preferences?.filter || 'all',
      sortBy: state?.preferences?.sortBy || 'newest',
      category: state?.preferences?.category || 'all',
    },
  };

  // Primary critical write: full versioned payload with all tasks and preferences
  const successData = storageSet(STORAGE_KEYS.DATA, payload);
  if (!successData) {
    return false;
  }

  // Secondary legacy preference writes: required for legacy loaders and unversioned fallbacks
  const themeSuccess = storageSet(STORAGE_KEYS.THEME, payload.preferences.theme);
  if (!themeSuccess) {
    return false;
  }

  const filterSuccess = storageSet(STORAGE_KEYS.FILTER, payload.preferences.filter);
  if (!filterSuccess) {
    return false;
  }

  return true;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

/**
 * Load all tasks from localStorage.
 *
 * @returns {import('./tasks.js').Task[]}
 */
export function loadTasks() {
  // Check versioned state first
  const versioned = storageGet(STORAGE_KEYS.DATA, null);
  if (versioned && typeof versioned === 'object' && Array.isArray(versioned.tasks)) {
    return versioned.tasks;
  }

  // Fallback to legacy unversioned tasks key
  const tasks = storageGet(STORAGE_KEYS.TASKS, null);
  if (tasks !== null) {
    if (!Array.isArray(tasks)) return [];
    return tasks;
  }

  return [];
}

/**
 * Persist the full task array to localStorage.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @returns {boolean} Whether the save succeeded.
 */
export function saveTasks(tasks) {
  const success = storageSet(STORAGE_KEYS.TASKS, tasks);
  if (!success) {
    return false;
  }

  // Keep versioned data in sync if available
  const existing = storageGet(STORAGE_KEYS.DATA, null);
  const versionedPayload = {
    version: CURRENT_SCHEMA_VERSION,
    tasks: Array.isArray(tasks) ? tasks : [],
    preferences: existing?.preferences || {
      theme: loadTheme(),
      filter: loadFilter(),
      sortBy: 'newest',
      category: 'all',
    },
  };
  return storageSet(STORAGE_KEYS.DATA, versionedPayload);
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
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
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
 * @returns {'all'|'pending'|'completed'|'today'|'upcoming'|'overdue'|'high'}
 */
export function loadFilter() {
  const saved = storageGet(STORAGE_KEYS.FILTER, 'all');
  const validFilters = ['all', 'pending', 'completed', 'today', 'upcoming', 'overdue', 'high'];
  return validFilters.includes(saved) ? saved : 'all';
}

/**
 * Persist the active filter.
 *
 * @param {string} filter
 * @returns {boolean}
 */
export function saveFilter(filter) {
  return storageSet(STORAGE_KEYS.FILTER, filter);
}

// ─── Export & Import ──────────────────────────────────────────────────────────

/**
 * Export the current application state as a formatted JSON string.
 *
 * @returns {string}
 */
export function exportAppStateJSON() {
  const state = loadAppState();
  return JSON.stringify(state, null, 2);
}

/**
 * Import application state from a JSON string, validating and sanitising tasks.
 *
 * @param {string} jsonString
 * @returns {{ success: boolean, count?: number, error?: string }}
 */
export function importAppStateJSON(jsonString) {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    return { success: false, error: 'Empty or invalid JSON content.' };
  }

  // Boundary check: enforce 5MB maximum import size before parsing
  if (jsonString.length > MAX_IMPORT_SIZE_BYTES) {
    return {
      success: false,
      error: `Import payload exceeds 5MB size limit (${(jsonString.length / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return { success: false, error: 'Invalid JSON file: ' + err.message };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'JSON root must be an object or array.' };
  }

  let rawTasks;
  let rawPreferences;

  if (Array.isArray(parsed)) {
    // Intentionally documented legacy import format: plain array of tasks
    rawTasks = parsed;
    rawPreferences = undefined;
  } else {
    // Root is an object: must contain a 'tasks' property
    if (!Object.prototype.hasOwnProperty.call(parsed, 'tasks') || parsed.tasks === undefined) {
      return { success: false, error: 'Backup is missing required "tasks" array.' };
    }
    if (!Array.isArray(parsed.tasks)) {
      return { success: false, error: '"tasks" property must be an array.' };
    }

    // Validate version if present
    if (Object.prototype.hasOwnProperty.call(parsed, 'version') && parsed.version !== undefined) {
      if (typeof parsed.version !== 'number' || parsed.version < 1 || parsed.version > CURRENT_SCHEMA_VERSION) {
        return {
          success: false,
          error: `Unsupported schema version: ${parsed.version}. Current supported version is ${CURRENT_SCHEMA_VERSION}.`,
        };
      }
    }

    rawTasks = parsed.tasks;
    rawPreferences = parsed.preferences;
  }

  // Boundary check: enforce maximum task limit to protect UI responsiveness and quota
  if (rawTasks.length > MAX_IMPORT_TASKS_LIMIT) {
    return {
      success: false,
      error: `Import exceeds maximum limit of ${MAX_IMPORT_TASKS_LIMIT} tasks (found ${rawTasks.length}).`,
    };
  }

  // Validate duplicate IDs
  const seenIds = new Set();
  for (const raw of rawTasks) {
    if (raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'id') && raw.id !== undefined && raw.id !== null) {
      const strId = String(raw.id);
      if (seenIds.has(strId)) {
        return {
          success: false,
          error: `Duplicate task ID detected in backup: "${strId}".`,
        };
      }
      seenIds.add(strId);
    }
  }

  // Validate preferences if provided
  let validatedPreferences;
  if (rawPreferences !== undefined) {
    if (typeof rawPreferences !== 'object' || rawPreferences === null || Array.isArray(rawPreferences)) {
      return { success: false, error: 'Preferences must be an object.' };
    }

    const validFilters = ['all', 'pending', 'completed', 'today', 'upcoming', 'overdue', 'high'];
    const validSorts = ['default', 'newest', 'oldest', 'priority', 'dueDate', 'updated'];

    validatedPreferences = {
      theme: rawPreferences.theme === 'dark' ? 'dark' : 'light',
      filter: validFilters.includes(rawPreferences.filter) ? rawPreferences.filter : 'all',
      sortBy: validSorts.includes(rawPreferences.sortBy) ? rawPreferences.sortBy : 'newest',
      category: (typeof rawPreferences.category === 'string' && rawPreferences.category.trim())
        ? rawPreferences.category.trim().slice(0, 50)
        : 'all',
    };
  }

  // Cleanse all task records
  const cleansed = cleanseTaskList(rawTasks);

  // Prevent malformed backups (where tasks were supplied but none were valid) from wiping out data
  if (rawTasks.length > 0 && cleansed.length === 0) {
    return { success: false, error: 'All task records in the backup are malformed or invalid.' };
  }

  // Retrieve current preferences as fallback if preferences were omitted
  const current = loadAppState();
  const stateToPersist = {
    version: CURRENT_SCHEMA_VERSION,
    tasks: cleansed,
    preferences: validatedPreferences || current.preferences,
  };

  const saveSuccess = saveAppState(stateToPersist);
  if (!saveSuccess) {
    return { success: false, error: 'Storage write failure: unable to persist imported data.' };
  }

  return { success: true, count: cleansed.length };
}

// ─── Memory Store Clear ───────────────────────────────────────────────────────

export function clearMemoryStore() {
  memoryStore.clear();
}
