/**
 * TaskFlow — tests/storage.test.js
 * Unit tests for the storage module.
 *
 * Because these tests run in Node.js (no browser), we stub
 * the localStorage and window.matchMedia globals before importing.
 *
 * Run: node --test tests/storage.test.js
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Minimal localStorage stub ─────────────────────────────────────────────

class LocalStorageStub {
  constructor() { this._store = {}; }
  getItem(k)        { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : null; }
  setItem(k, v)     { this._store[k] = String(v); }
  removeItem(k)     { delete this._store[k]; }
  clear()           { this._store = {}; }
  key(i)            { return Object.keys(this._store)[i] ?? null; }
  get length()      { return Object.keys(this._store).length; }
}

const stubStorage = new LocalStorageStub();
globalThis.localStorage    = stubStorage;
globalThis.window          = { matchMedia: () => ({ matches: false }) };

// ─── Import after stub is in place ─────────────────────────────────────────

const {
  loadTasks, saveTasks,
  loadTheme, saveTheme,
  loadFilter, saveFilter,
  storageAvailable,
  STORAGE_KEYS,
  CURRENT_SCHEMA_VERSION,
  loadAppState,
  saveAppState,
  validateTaskRecord,
  cleanseTaskList,
  clearMemoryStore,
  exportAppStateJSON,
  importAppStateJSON,
} = await import('../js/storage.js');

// ─── storageAvailable ──────────────────────────────────────────────────────

describe('storageAvailable', () => {
  test('returns true when localStorage is functional', () => {
    assert.ok(storageAvailable());
  });
});

// ─── Tasks persistence ──────────────────────────────────────────────────────

describe('loadTasks / saveTasks', () => {

  beforeEach(() => stubStorage.clear());

  test('loadTasks returns empty array when nothing is stored', () => {
    assert.deepEqual(loadTasks(), []);
  });

  test('saveTasks persists and loadTasks retrieves the data', () => {
    const tasks = [{ id: '1', title: 'Test task', status: 'pending', priority: 'low' }];
    saveTasks(tasks);
    assert.deepEqual(loadTasks(), tasks);
  });

  test('loadTasks returns empty array when stored value is corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEYS.TASKS, '{{{invalid');
    assert.deepEqual(loadTasks(), []);
  });

  test('loadTasks returns empty array when stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify({ oops: true }));
    assert.deepEqual(loadTasks(), []);
  });

  test('saveTasks returns true on success', () => {
    const result = saveTasks([]);
    assert.equal(result, true);
  });
});

// ─── Theme persistence ──────────────────────────────────────────────────────

describe('loadTheme / saveTheme', () => {

  beforeEach(() => stubStorage.clear());

  test('loadTheme returns "light" when nothing is stored (no OS dark preference)', () => {
    assert.equal(loadTheme(), 'light');
  });

  test('saveTheme persists and loadTheme retrieves "dark"', () => {
    saveTheme('dark');
    assert.equal(loadTheme(), 'dark');
  });

  test('saveTheme persists and loadTheme retrieves "light"', () => {
    saveTheme('light');
    assert.equal(loadTheme(), 'light');
  });

  test('loadTheme returns "light" for invalid stored value', () => {
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify('rainbow'));
    assert.equal(loadTheme(), 'light');
  });

  test('saveTheme returns true on success', () => {
    assert.equal(saveTheme('dark'), true);
  });
});

// ─── Filter persistence ──────────────────────────────────────────────────────

describe('loadFilter / saveFilter', () => {

  beforeEach(() => stubStorage.clear());

  test('loadFilter returns "all" by default', () => {
    assert.equal(loadFilter(), 'all');
  });

  test('saveFilter persists and loadFilter retrieves "pending"', () => {
    saveFilter('pending');
    assert.equal(loadFilter(), 'pending');
  });

  test('saveFilter persists and loadFilter retrieves "completed"', () => {
    saveFilter('completed');
    assert.equal(loadFilter(), 'completed');
  });

  test('loadFilter returns "all" for invalid stored value', () => {
    localStorage.setItem(STORAGE_KEYS.FILTER, JSON.stringify('unknown'));
    assert.equal(loadFilter(), 'all');
  });

  test('saveFilter returns true on success', () => {
    assert.equal(saveFilter('all'), true);
  });
});

// ─── Versioned App State (Phase 2) ───────────────────────────────────────────

describe('CURRENT_SCHEMA_VERSION', () => {
  test('is schema version 1', () => {
    assert.equal(CURRENT_SCHEMA_VERSION, 1);
  });
});

describe('validateTaskRecord', () => {
  test('returns cleansed task object for a fully formed task', () => {
    const valid = validateTaskRecord({
      id: 'abc-123',
      title: 'Valid Task',
      status: 'pending',
      priority: 'high',
      category: 'Work',
      completed: false,
    });
    assert.ok(valid);
    assert.equal(valid.id, 'abc-123');
    assert.equal(valid.title, 'Valid Task');
    assert.equal(valid.category, 'Work');
  });

  test('returns null for null or non-objects', () => {
    assert.equal(validateTaskRecord(null), null);
    assert.equal(validateTaskRecord('string'), null);
    assert.equal(validateTaskRecord(123), null);
  });

  test('returns null for object missing title', () => {
    assert.equal(validateTaskRecord({ id: '1', status: 'pending' }), null);
  });
});

describe('cleanseTaskList', () => {
  test('preserves valid tasks and populates missing default attributes', () => {
    const raw = [
      { id: '1', title: 'Task 1', status: 'pending', priority: 'medium' },
      { id: '2', title: 'Task 2', status: 'completed', priority: 'high', category: 'Study' },
      null,
      'invalid',
      { id: '3' }, // missing title
    ];

    const cleansed = cleanseTaskList(raw);
    assert.equal(cleansed.length, 2);
    assert.equal(cleansed[0].category, 'General');
    assert.equal(cleansed[0].completed, false);
    assert.equal(cleansed[1].category, 'Study');
    assert.equal(cleansed[1].completed, true);
  });
});

describe('loadAppState / saveAppState', () => {
  beforeEach(() => {
    stubStorage.clear();
    clearMemoryStore();
  });

  test('loadAppState returns default state when nothing is stored', () => {
    const state = loadAppState();
    assert.equal(state.version, 1);
    assert.deepEqual(state.tasks, []);
    assert.equal(state.preferences.theme, 'light');
    assert.equal(state.preferences.filter, 'all');
    assert.equal(state.preferences.sortBy, 'newest');
    assert.equal(state.preferences.category, 'all');
  });

  test('saveAppState persists state and loadAppState retrieves it', () => {
    const payload = {
      version: 1,
      tasks: [{ id: '1', title: 'State task', status: 'pending', priority: 'low', category: 'Work', completed: false, dueDate: null }],
      preferences: { theme: 'dark', filter: 'today', sortBy: 'priority', category: 'Work' },
    };

    const saved = saveAppState(payload);
    assert.equal(saved, true);

    const loaded = loadAppState();
    assert.equal(loaded.version, 1);
    assert.equal(loaded.tasks.length, 1);
    assert.equal(loaded.tasks[0].title, 'State task');
    assert.equal(loaded.preferences.theme, 'dark');
    assert.equal(loaded.preferences.filter, 'today');
    assert.equal(loaded.preferences.sortBy, 'priority');
    assert.equal(loaded.preferences.category, 'Work');
  });

  test('loadAppState falls back to legacy keys if taskflow_data is absent', () => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([
      { id: 'leg-1', title: 'Legacy Task', status: 'pending', priority: 'high' }
    ]));
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify('dark'));
    localStorage.setItem(STORAGE_KEYS.FILTER, JSON.stringify('completed'));

    const state = loadAppState();
    assert.equal(state.tasks.length, 1);
    assert.equal(state.tasks[0].title, 'Legacy Task');
    assert.equal(state.tasks[0].category, 'General');
    assert.equal(state.preferences.theme, 'dark');
    assert.equal(state.preferences.filter, 'completed');
  });

  test('loadAppState handles corrupt JSON safely', () => {
    localStorage.setItem(STORAGE_KEYS.APP_STATE, '{not-valid-json');
    const state = loadAppState();
    assert.equal(state.version, 1);
    assert.deepEqual(state.tasks, []);
  });
});

describe('exportAppStateJSON / importAppStateJSON', () => {
  beforeEach(() => {
    stubStorage.clear();
    clearMemoryStore();
  });

  test('exportAppStateJSON returns valid serialized JSON', () => {
    saveTasks([{ id: 'exp-1', title: 'Export me', status: 'pending', priority: 'medium', category: 'Work' }]);
    const json = exportAppStateJSON();
    assert.equal(typeof json, 'string');
    const parsed = JSON.parse(json);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.tasks.length, 1);
    assert.equal(parsed.tasks[0].title, 'Export me');
  });

  test('importAppStateJSON successfully restores tasks from valid JSON', () => {
    const backup = JSON.stringify({
      version: 1,
      tasks: [
        { id: 'imp-1', title: 'Imported task', status: 'completed', priority: 'high', category: 'Study' }
      ],
      preferences: { theme: 'dark', filter: 'completed' },
    });

    const res = importAppStateJSON(backup);
    assert.equal(res.success, true);
    assert.equal(res.count, 1);

    const loaded = loadAppState();
    assert.equal(loaded.tasks.length, 1);
    assert.equal(loaded.tasks[0].title, 'Imported task');
    assert.equal(loaded.tasks[0].completed, true);
    assert.equal(loaded.preferences.theme, 'dark');
  });

  test('importAppStateJSON gracefully rejects invalid JSON', () => {
    const res = importAppStateJSON('not a json');
    assert.equal(res.success, false);
    assert.ok(res.error);
  });

  test('importAppStateJSON cleanses malformed records', () => {
    const raw = JSON.stringify({
      tasks: [
        { id: 'good', title: 'Good task' },
        { id: 'bad-no-title' },
        null,
        123
      ]
    });

    const res = importAppStateJSON(raw);
    assert.equal(res.success, true);
    assert.equal(res.count, 1);
  });
});
