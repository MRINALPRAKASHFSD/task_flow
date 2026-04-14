/**
 * TaskFlow — tests/filters.test.js
 * Unit tests for filter and sort logic.
 *
 * Run: node --test tests/filters.test.js
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  filterByStatus,
  filterBySearch,
  applyFilters,
  sortTasks,
} from '../js/filters.js';

import {
  createTask,
  toggleTaskStatus,
  replaceTask,
} from '../js/tasks.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTask(overrides = {}) {
  return createTask({ title: 'Test task', priority: 'medium', ...overrides });
}

function makeCompleted(task) {
  return toggleTaskStatus(task);
}

// ─── filterByStatus ───────────────────────────────────────────────────────────

describe('filterByStatus', () => {

  test('"all" returns all tasks', () => {
    const t1 = makeTask({ title: 'Pending' });
    const t2 = makeCompleted(makeTask({ title: 'Done' }));
    const result = filterByStatus([t1, t2], 'all');
    assert.equal(result.length, 2);
  });

  test('"pending" returns only pending tasks', () => {
    const t1 = makeTask({ title: 'Pending' });
    const t2 = makeCompleted(makeTask({ title: 'Done' }));
    const result = filterByStatus([t1, t2], 'pending');
    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'pending');
  });

  test('"completed" returns only completed tasks', () => {
    const t1 = makeTask({ title: 'Pending' });
    const t2 = makeCompleted(makeTask({ title: 'Done' }));
    const result = filterByStatus([t1, t2], 'completed');
    assert.equal(result.length, 1);
    assert.equal(result[0].status, 'completed');
  });

  test('returns empty array when no tasks match filter', () => {
    const t1 = makeTask({ title: 'Pending only' });
    const result = filterByStatus([t1], 'completed');
    assert.equal(result.length, 0);
  });

  test('unknown filter defaults to all tasks', () => {
    const t1 = makeTask({ title: 'A' });
    const result = filterByStatus([t1], 'unknown');
    assert.equal(result.length, 1);
  });
});

// ─── filterBySearch ───────────────────────────────────────────────────────────

describe('filterBySearch', () => {

  test('empty query returns all tasks', () => {
    const tasks = [makeTask({ title: 'Buy groceries' }), makeTask({ title: 'Walk the dog' })];
    assert.equal(filterBySearch(tasks, '').length, 2);
  });

  test('matches by title (case-insensitive)', () => {
    const tasks = [makeTask({ title: 'Buy Groceries' }), makeTask({ title: 'Walk the dog' })];
    const result = filterBySearch(tasks, 'groceries');
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Buy Groceries');
  });

  test('matches by description', () => {
    const tasks = [
      createTask({ title: 'Task A', description: 'Milk and eggs' }),
      createTask({ title: 'Task B', description: 'Walk in the park' }),
    ];
    const result = filterBySearch(tasks, 'milk');
    assert.equal(result.length, 1);
  });

  test('returns empty array when no tasks match', () => {
    const tasks = [makeTask({ title: 'Alpha' })];
    const result = filterBySearch(tasks, 'zzzzzz');
    assert.equal(result.length, 0);
  });

  test('trims whitespace from query', () => {
    const tasks = [makeTask({ title: 'Clean kitchen' })];
    const result = filterBySearch(tasks, '  kitchen  ');
    assert.equal(result.length, 1);
  });

  test('partial query matches', () => {
    const tasks = [makeTask({ title: 'Deploy application' })];
    const result = filterBySearch(tasks, 'deploy');
    assert.equal(result.length, 1);
  });
});

// ─── applyFilters ─────────────────────────────────────────────────────────────

describe('applyFilters', () => {

  test('applies both status and search filters together', () => {
    const tasks = [
      createTask({ title: 'Write tests' }),
      createTask({ title: 'Write docs' }),
      makeCompleted(createTask({ title: 'Write report' })),
    ];

    const result = applyFilters(tasks, { status: 'pending', search: 'Write' });
    assert.equal(result.length, 2);
    result.forEach(t => {
      assert.equal(t.status, 'pending');
      assert.ok(t.title.toLowerCase().includes('write'));
    });
  });

  test('uses defaults when options are omitted', () => {
    const tasks = [makeTask({ title: 'A' }), makeTask({ title: 'B' })];
    assert.equal(applyFilters(tasks).length, 2);
  });

  test('returns empty array when no tasks pass both filters', () => {
    const tasks = [makeCompleted(createTask({ title: 'Buy milk' }))];
    const result = applyFilters(tasks, { status: 'pending', search: 'milk' });
    assert.equal(result.length, 0);
  });
});

// ─── sortTasks ────────────────────────────────────────────────────────────────

describe('sortTasks', () => {

  test('places high-priority tasks before medium and low', () => {
    const low    = createTask({ title: 'Low',    priority: 'low' });
    const medium = createTask({ title: 'Medium', priority: 'medium' });
    const high   = createTask({ title: 'High',   priority: 'high' });
    const sorted = sortTasks([low, medium, high]);
    assert.equal(sorted[0].priority, 'high');
    assert.equal(sorted[1].priority, 'medium');
    assert.equal(sorted[2].priority, 'low');
  });

  test('places completed tasks after pending tasks', () => {
    const pending   = createTask({ title: 'Pending' });
    const completed = makeCompleted(createTask({ title: 'Completed' }));
    const sorted = sortTasks([completed, pending]);
    assert.equal(sorted[0].status, 'pending');
    assert.equal(sorted[1].status, 'completed');
  });

  test('does not mutate the original array', () => {
    const tasks = [
      createTask({ title: 'A', priority: 'low' }),
      createTask({ title: 'B', priority: 'high' }),
    ];
    const originalOrder = tasks.map(t => t.title);
    sortTasks(tasks);
    assert.deepEqual(tasks.map(t => t.title), originalOrder);
  });

  test('handles empty array', () => {
    assert.deepEqual(sortTasks([]), []);
  });

  test('handles single-element array', () => {
    const t = createTask({ title: 'Solo' });
    const sorted = sortTasks([t]);
    assert.equal(sorted.length, 1);
  });
});
