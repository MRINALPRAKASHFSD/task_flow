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
