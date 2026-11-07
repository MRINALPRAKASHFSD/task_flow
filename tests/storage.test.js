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
  MAX_IMPORT_SIZE_BYTES,
  MAX_IMPORT_TASKS_LIMIT,
  isQuotaError,
  getLastStorageError,
  clearLastStorageError,
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

  test('saveAppState avoids redundant writes to STORAGE_KEYS.TASKS while persisting versioned data', () => {
    const payload = {
      version: 1,
      tasks: [{ id: 'nr-1', title: 'Non-redundant task', status: 'pending', priority: 'medium', category: 'General', completed: false, dueDate: null }],
      preferences: { theme: 'light', filter: 'all', sortBy: 'newest', category: 'all' },
    };

    const saved = saveAppState(payload);
    assert.equal(saved, true);

    // Primary versioned key must exist with payload
    const rawData = localStorage.getItem(STORAGE_KEYS.DATA);
    assert.ok(rawData);
    const parsedData = JSON.parse(rawData);
    assert.equal(parsedData.tasks[0].id, 'nr-1');

    // Duplicate key must not be written, saving quota
    assert.equal(localStorage.getItem(STORAGE_KEYS.TASKS), null);

    // Both state loader and legacy task loader retrieve the data from STORAGE_KEYS.DATA
    assert.equal(loadAppState().tasks[0].id, 'nr-1');
    assert.equal(loadTasks()[0].id, 'nr-1');
  });

  test('loadAppState falls back to legacy keys if taskflow_data is absent and migrates data', () => {
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

    // Migration must have populated STORAGE_KEYS.DATA
    const migratedRaw = localStorage.getItem(STORAGE_KEYS.DATA);
    assert.ok(migratedRaw);
    const migrated = JSON.parse(migratedRaw);
    assert.equal(migrated.tasks[0].id, 'leg-1');
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

  test('importAppStateJSON rejects empty JSON string', () => {
    assert.equal(importAppStateJSON('').success, false);
    assert.equal(importAppStateJSON('   ').success, false);
    assert.equal(importAppStateJSON(null).success, false);
  });

  test('importAppStateJSON rejects empty objects', () => {
    const res = importAppStateJSON('{}');
    assert.equal(res.success, false);
    assert.match(res.error, /missing required "tasks"/i);
  });

  test('importAppStateJSON rejects missing tasks property in objects', () => {
    const res = importAppStateJSON(JSON.stringify({ preferences: { theme: 'dark' } }));
    assert.equal(res.success, false);
    assert.match(res.error, /missing required "tasks"/i);
  });

  test('importAppStateJSON rejects invalid tasks type', () => {
    const resString = importAppStateJSON(JSON.stringify({ tasks: 'not-an-array' }));
    assert.equal(resString.success, false);
    assert.match(resString.error, /"tasks" property must be an array/i);

    const resNumber = importAppStateJSON(JSON.stringify({ tasks: 42 }));
    assert.equal(resNumber.success, false);
    assert.match(resNumber.error, /"tasks" property must be an array/i);
  });

  test('importAppStateJSON rejects unsupported schema versions', () => {
    const resHigh = importAppStateJSON(JSON.stringify({ version: 999, tasks: [] }));
    assert.equal(resHigh.success, false);
    assert.match(resHigh.error, /unsupported schema version/i);

    const resZero = importAppStateJSON(JSON.stringify({ version: 0, tasks: [] }));
    assert.equal(resZero.success, false);
    assert.match(resZero.error, /unsupported schema version/i);
  });

  test('importAppStateJSON rejects backups with duplicate task IDs', () => {
    const payload = JSON.stringify({
      version: 1,
      tasks: [
        { id: 'task-100', title: 'First Task' },
        { id: 'task-100', title: 'Duplicate Task' }
      ]
    });
    const res = importAppStateJSON(payload);
    assert.equal(res.success, false);
    assert.match(res.error, /duplicate task id detected/i);
  });

  test('importAppStateJSON rejects backup if all task records are malformed', () => {
    const payload = JSON.stringify({
      version: 1,
      tasks: [
        null,
        { missingTitle: true },
        123
      ]
    });
    const res = importAppStateJSON(payload);
    assert.equal(res.success, false);
    assert.match(res.error, /all task records in the backup are malformed/i);
  });

  test('importAppStateJSON handles storage write failure gracefully', () => {
    const originalSetItem = stubStorage.setItem;
    stubStorage.setItem = () => {
      throw new Error('QuotaExceededError: LocalStorage quota exceeded');
    };

    try {
      const payload = JSON.stringify({
        version: 1,
        tasks: [{ id: 'write-fail-test', title: 'Valid Task' }]
      });
      const res = importAppStateJSON(payload);
      assert.equal(res.success, false);
      assert.match(res.error, /storage write failure/i);
    } finally {
      stubStorage.setItem = originalSetItem;
    }
  });

  test('importAppStateJSON preserves existing data after rejected imports', () => {
    // 1. Establish valid baseline state
    saveAppState({
      version: 1,
      tasks: [
        {
          id: 'initial-task-1',
          title: 'Preserved Task 1',
          description: 'Must not be overwritten',
          priority: 'high',
          category: 'Work',
          status: 'pending',
          completed: false,
          dueDate: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      preferences: {
        theme: 'light',
        filter: 'all',
        sortBy: 'newest',
        category: 'Work'
      }
    });

    const baseline = loadAppState();
    assert.equal(baseline.tasks.length, 1);
    assert.equal(baseline.tasks[0].id, 'initial-task-1');

    // 2. Attempt empty object
    const resEmpty = importAppStateJSON('{}');
    assert.equal(resEmpty.success, false);
    assert.equal(loadAppState().tasks[0].id, 'initial-task-1');

    // 3. Attempt duplicate ID
    const resDup = importAppStateJSON(JSON.stringify({
      version: 1,
      tasks: [
        { id: 'dup-x', title: 'Task A' },
        { id: 'dup-x', title: 'Task B' }
      ]
    }));
    assert.equal(resDup.success, false);
    assert.equal(loadAppState().tasks[0].id, 'initial-task-1');

    // 4. Attempt unsupported schema version
    const resVersion = importAppStateJSON(JSON.stringify({
      version: 42,
      tasks: [{ id: 'bad-ver', title: 'Future task' }]
    }));
    assert.equal(resVersion.success, false);
    assert.equal(loadAppState().tasks[0].id, 'initial-task-1');

    // 5. Attempt invalid tasks type
    const resType = importAppStateJSON(JSON.stringify({ tasks: 'not an array' }));
    assert.equal(resType.success, false);
    assert.equal(loadAppState().tasks[0].id, 'initial-task-1');
  });

  test('importAppStateJSON rejects payloads exceeding 5MB size limit', () => {
    // Generate a payload that exceeds 5MB (5 * 1024 * 1024 bytes)
    const padding = 'x'.repeat(MAX_IMPORT_SIZE_BYTES + 10);
    const res = importAppStateJSON(padding);
    assert.equal(res.success, false);
    assert.match(res.error, /exceeds 5MB size limit/i);
  });

  test('importAppStateJSON rejects task arrays exceeding 5,000 tasks limit', () => {
    const excessiveTasks = [];
    for (let i = 0; i < MAX_IMPORT_TASKS_LIMIT + 1; i++) {
      excessiveTasks.push({ id: `task-${i}`, title: `Task ${i}` });
    }
    const payload = JSON.stringify({ version: 1, tasks: excessiveTasks });
    const res = importAppStateJSON(payload);
    assert.equal(res.success, false);
    assert.match(res.error, /exceeds maximum limit of 5000 tasks/i);
  });
});

describe('Storage Error Handling & Quota Detection', () => {
  beforeEach(() => {
    stubStorage.clear();
    clearMemoryStore();
    clearLastStorageError();
  });

  test('isQuotaError accurately detects QuotaExceededError across browser engines', () => {
    assert.equal(isQuotaError(new Error('QuotaExceededError')), true);
    assert.equal(isQuotaError({ name: 'QuotaExceededError' }), true);
    assert.equal(isQuotaError({ code: 22 }), true);
    assert.equal(isQuotaError({ code: 1014 }), true);
    assert.equal(isQuotaError(new Error('NS_ERROR_DOM_QUOTA_REACHED')), true);
    assert.equal(isQuotaError(new Error('Persistent storage quota has been exceeded')), true);
    assert.equal(isQuotaError(new Error('Generic network failure')), false);
    assert.equal(isQuotaError(null), false);
  });

  test('saveAppState captures quota error and returns false on quota exhaustion', () => {
    const originalSetItem = stubStorage.setItem;
    stubStorage.setItem = () => {
      const err = new Error('QuotaExceededError: LocalStorage quota reached');
      err.name = 'QuotaExceededError';
      throw err;
    };

    try {
      const state = {
        version: 1,
        tasks: [{ id: 'q-1', title: 'Quota task', priority: 'high', category: 'Work', status: 'pending', completed: false, dueDate: null }],
        preferences: { theme: 'light', filter: 'all', sortBy: 'newest', category: 'all' }
      };

      const result = saveAppState(state);
      assert.equal(result, false);

      const lastErr = getLastStorageError();
      assert.ok(lastErr);
      assert.equal(lastErr.type, 'quota');
      assert.match(lastErr.message, /quota/i);
    } finally {
      stubStorage.setItem = originalSetItem;
    }
  });

  test('saveAppState halts partial writes when primary versioned payload fails', () => {
    let attemptedKeys = [];
    const originalSetItem = stubStorage.setItem;
    stubStorage.setItem = (k) => {
      attemptedKeys.push(k);
      if (k === STORAGE_KEYS.DATA) {
        throw new Error('Disk write error');
      }
    };

    try {
      const state = {
        version: 1,
        tasks: [{ id: 'pw-1', title: 'Partial write task' }],
        preferences: { theme: 'dark', filter: 'pending', sortBy: 'priority', category: 'Work' }
      };

      const result = saveAppState(state);
      assert.equal(result, false);

      // Must not continue to write THEME and FILTER keys when DATA fails
      assert.deepEqual(attemptedKeys, [STORAGE_KEYS.DATA]);
    } finally {
      stubStorage.setItem = originalSetItem;
    }
  });

  test('saveAppState returns false when secondary THEME write fails', () => {
    const originalSetItem = stubStorage.setItem;
    stubStorage.setItem = (k, v) => {
      if (k === STORAGE_KEYS.THEME) {
        const err = new Error('Quota exceeded on theme key');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return originalSetItem.call(stubStorage, k, v);
    };

    try {
      const state = {
        version: 1,
        tasks: [{ id: 'sec-1', title: 'Secondary write test' }],
        preferences: { theme: 'dark', filter: 'all', sortBy: 'newest', category: 'all' }
      };

      const result = saveAppState(state);
      assert.equal(result, false);

      const err = getLastStorageError();
      assert.ok(err);
      assert.equal(err.key, STORAGE_KEYS.THEME);
      assert.equal(err.type, 'quota');
    } finally {
      stubStorage.setItem = originalSetItem;
    }
  });

  test('saveAppState returns false when secondary FILTER write fails', () => {
    const originalSetItem = stubStorage.setItem;
    stubStorage.setItem = (k, v) => {
      if (k === STORAGE_KEYS.FILTER) {
        throw new Error('Write error on filter key');
      }
      return originalSetItem.call(stubStorage, k, v);
    };

    try {
      const state = {
        version: 1,
        tasks: [{ id: 'sec-2', title: 'Secondary filter write test' }],
        preferences: { theme: 'light', filter: 'pending', sortBy: 'newest', category: 'all' }
      };

      const result = saveAppState(state);
      assert.equal(result, false);

      const err = getLastStorageError();
      assert.ok(err);
      assert.equal(err.key, STORAGE_KEYS.FILTER);
    } finally {
      stubStorage.setItem = originalSetItem;
    }
  });

  test('saveTasks halts and returns false when primary TASKS write fails', () => {
    let attemptedKeys = [];
    const originalSetItem = stubStorage.setItem;
    stubStorage.setItem = (k) => {
      attemptedKeys.push(k);
      if (k === STORAGE_KEYS.TASKS) {
        throw new Error('Tasks disk error');
      }
    };

    try {
      const result = saveTasks([{ id: 'st-fail-1', title: 'Halt on tasks fail' }]);
      assert.equal(result, false);
      assert.deepEqual(attemptedKeys, [STORAGE_KEYS.TASKS]);
    } finally {
      stubStorage.setItem = originalSetItem;
    }
  });

  test('saveTasks returns false when secondary DATA write fails', () => {
    const originalSetItem = stubStorage.setItem;
    stubStorage.setItem = (k, v) => {
      if (k === STORAGE_KEYS.DATA) {
        throw new Error('Data disk error in saveTasks');
      }
      return originalSetItem.call(stubStorage, k, v);
    };

    try {
      const result = saveTasks([{ id: 'st-fail-2', title: 'Fail on data sync' }]);
      assert.equal(result, false);
    } finally {
      stubStorage.setItem = originalSetItem;
    }
  });
});
