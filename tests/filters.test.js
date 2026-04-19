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
  filterByCategory,
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

  test('"today" returns tasks due today', () => {
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const tToday = makeTask({ title: 'Today Task', dueDate: todayStr });
    const tFuture = makeTask({ title: 'Future Task', dueDate: '2099-01-01' });
    const result = filterByStatus([tToday, tFuture], 'today');
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Today Task');
  });

  test('"upcoming" returns future pending tasks', () => {
    const tFuture = makeTask({ title: 'Upcoming Task', dueDate: '2099-01-01' });
    const tDone = makeCompleted(makeTask({ title: 'Done Task', dueDate: '2099-01-01' }));
    const result = filterByStatus([tFuture, tDone], 'upcoming');
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Upcoming Task');
  });

  test('"overdue" returns only overdue pending tasks', () => {
    const tLate = makeTask({ title: 'Late Task', dueDate: '2020-01-01' });
    const tLateDone = makeCompleted(makeTask({ title: 'Late Done', dueDate: '2020-01-01' }));
    const result = filterByStatus([tLate, tLateDone], 'overdue');
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Late Task');
  });

  test('"high" returns high priority pending tasks', () => {
    const tHigh = makeTask({ title: 'Important', priority: 'high' });
    const tHighDone = makeCompleted(makeTask({ title: 'Done High', priority: 'high' }));
    const tMed = makeTask({ title: 'Normal', priority: 'medium' });
    const result = filterByStatus([tHigh, tHighDone, tMed], 'high');
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Important');
  });
});

// ─── filterByCategory ─────────────────────────────────────────────────────────

describe('filterByCategory', () => {
  test('filters tasks strictly matching category (case-insensitive)', () => {
    const tWork = makeTask({ title: 'Write PR', category: 'Work' });
    const tHome = makeTask({ title: 'Vacuum', category: 'Personal' });
    const result = filterByCategory([tWork, tHome], 'Work');
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Write PR');
  });

  test('returns all tasks when category is "all" or omitted', () => {
    const t1 = makeTask({ title: 'A', category: 'Work' });
    const t2 = makeTask({ title: 'B', category: 'Personal' });
    assert.equal(filterByCategory([t1, t2], 'all').length, 2);
    assert.equal(filterByCategory([t1, t2], '').length, 2);
  });

  test('returns empty array when category has no matching tasks', () => {
    const t1 = makeTask({ title: 'A', category: 'Work' });
    assert.equal(filterByCategory([t1], 'Finance').length, 0);
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

  test('matches by category', () => {
    const tasks = [
      makeTask({ title: 'Tax return', category: 'Finance' }),
      makeTask({ title: 'Yoga routine', category: 'Health' }),
    ];
    const result = filterBySearch(tasks, 'finance');
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Tax return');
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

  test('applies status, category, search, and sortBy simultaneously', () => {
    const t1 = createTask({ title: 'Review pull request', category: 'Work', priority: 'low' });
    const t2 = createTask({ title: 'Submit pull request', category: 'Work', priority: 'high' });
    const t3 = createTask({ title: 'Work out at gym', category: 'Health', priority: 'high' });

    const result = applyFilters([t1, t2, t3], {
      status: 'pending',
      category: 'Work',
      search: 'request',
      sortBy: 'priority',
    });

    assert.equal(result.length, 2);
    assert.equal(result[0].title, 'Submit pull request');
    assert.equal(result[1].title, 'Review pull request');
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

  test('sorts by newest first (createdAt descending)', () => {
    const t1 = { ...createTask({ title: 'Older' }), createdAt: '2026-01-01T10:00:00.000Z' };
    const t2 = { ...createTask({ title: 'Newer' }), createdAt: '2026-02-01T10:00:00.000Z' };
    const sorted = sortTasks([t1, t2], 'newest');
    assert.equal(sorted[0].title, 'Newer');
    assert.equal(sorted[1].title, 'Older');
  });

  test('sorts by oldest first (createdAt ascending)', () => {
    const t1 = { ...createTask({ title: 'Older' }), createdAt: '2026-01-01T10:00:00.000Z' };
    const t2 = { ...createTask({ title: 'Newer' }), createdAt: '2026-02-01T10:00:00.000Z' };
    const sorted = sortTasks([t2, t1], 'oldest');
    assert.equal(sorted[0].title, 'Older');
    assert.equal(sorted[1].title, 'Newer');
  });

  test('sorts by dueDate (earliest due first, with dates before without)', () => {
    const tNoDate = createTask({ title: 'No date' });
    const tLater = createTask({ title: 'Later', dueDate: '2026-10-15' });
    const tSooner = createTask({ title: 'Sooner', dueDate: '2026-05-01' });

    const sorted = sortTasks([tNoDate, tLater, tSooner], 'dueDate');
    assert.equal(sorted[0].title, 'Sooner');
    assert.equal(sorted[1].title, 'Later');
    assert.equal(sorted[2].title, 'No date');
  });

  test('sorts by recently updated (updatedAt descending)', () => {
    const t1 = { ...createTask({ title: 'Stale' }), updatedAt: '2026-01-01T10:00:00.000Z' };
    const t2 = { ...createTask({ title: 'Fresh' }), updatedAt: '2026-03-01T10:00:00.000Z' };
    const sorted = sortTasks([t1, t2], 'updated');
    assert.equal(sorted[0].title, 'Fresh');
    assert.equal(sorted[1].title, 'Stale');
  });
});
