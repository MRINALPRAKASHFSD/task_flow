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
  countTasksByCategory,
} from '../js/filters.js';

import {
  createTask,
  updateTask,
  deleteTask,
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

  test('completing a task under default sorting moves it from top to after pending tasks', () => {
    const t1 = createTask({ title: 'Task 1', priority: 'high' });
    const t2 = createTask({ title: 'Task 2', priority: 'medium' });
    const t3 = createTask({ title: 'Task 3', priority: 'low' });

    // Initially all pending: t1 (high), t2 (med), t3 (low)
    const initialOrder = sortTasks([t1, t2, t3], 'default');
    assert.equal(initialOrder[0].id, t1.id);
    assert.equal(initialOrder[1].id, t2.id);
    assert.equal(initialOrder[2].id, t3.id);

    // Complete t1
    const completedT1 = makeCompleted(t1);
    const updatedOrder = sortTasks([completedT1, t2, t3], 'default');

    // Completed t1 must settle to the bottom; pending t2 and t3 stay above it
    assert.equal(updatedOrder[0].id, t2.id);
    assert.equal(updatedOrder[1].id, t3.id);
    assert.equal(updatedOrder[2].id, completedT1.id);
  });

  test('priority and due-date sorting sink completed tasks below pending tasks', () => {
    const tPrioHigh = makeCompleted(createTask({ title: 'High Done', priority: 'high' }));
    const tPrioLow = createTask({ title: 'Low Pending', priority: 'low' });

    // Under priority sort, completed high-priority task sinks below pending low-priority task
    const prioSorted = sortTasks([tPrioHigh, tPrioLow], 'priority');
    assert.equal(prioSorted[0].id, tPrioLow.id);
    assert.equal(prioSorted[1].id, tPrioHigh.id);

    const tDueEarly = makeCompleted(createTask({ title: 'Due Early Done', dueDate: '2026-01-01' }));
    const tDueLate = createTask({ title: 'Due Late Pending', dueDate: '2026-12-31' });

    // Under dueDate sort, completed early task sinks below pending late task
    const dueSorted = sortTasks([tDueEarly, tDueLate], 'dueDate');
    assert.equal(dueSorted[0].id, tDueLate.id);
    assert.equal(dueSorted[1].id, tDueEarly.id);
  });

  test('sort modes unaffected by completion (newest, oldest) preserve identical relative positions', () => {
    const tNew = { ...createTask({ title: 'New' }), createdAt: '2026-02-01T10:00:00.000Z' };
    const tOld = { ...createTask({ title: 'Old' }), createdAt: '2026-01-01T10:00:00.000Z' };

    // Newest sort before completion
    const beforeSort = sortTasks([tOld, tNew], 'newest');
    assert.equal(beforeSort[0].title, 'New');
    assert.equal(beforeSort[1].title, 'Old');

    // Complete tNew
    const completedNew = makeCompleted(tNew);
    const afterSort = sortTasks([tOld, completedNew], 'newest');

    // Order is strictly preserved under newest
    assert.equal(afterSort[0].title, 'New');
    assert.equal(afterSort[1].title, 'Old');

    // Complete tOld
    const completedOld = makeCompleted(tOld);
    const oldestSort = sortTasks([completedOld, completedNew], 'oldest');
    assert.equal(oldestSort[0].title, 'Old');
    assert.equal(oldestSort[1].title, 'New');
  });

  test('recurring task insertion respects active sort order', () => {
    // Existing pending tasks
    const existingLater = createTask({ title: 'Task Next Week', dueDate: '2026-11-20', priority: 'medium' });
    const existingFar = createTask({ title: 'Task Next Month', dueDate: '2026-12-01', priority: 'medium' });

    // Completed recurring task
    const recurringOriginal = makeCompleted(createTask({ title: 'Weekly Meeting', dueDate: '2026-11-05' }));

    // Next recurring task spawned for next week
    const recurringNext = createTask({ title: 'Weekly Meeting', dueDate: '2026-11-12', priority: 'medium' });

    const allTasks = [existingFar, existingLater, recurringOriginal, recurringNext];

    // Sorted by dueDate
    const sorted = sortTasks(allTasks, 'dueDate');

    // Pending tasks ordered by dueDate: 2026-11-12 (recurringNext), 2026-11-20 (existingLater), 2026-12-01 (existingFar)
    // Completed task sinks to bottom: recurringOriginal
    assert.equal(sorted[0].id, recurringNext.id);
    assert.equal(sorted[1].id, existingLater.id);
    assert.equal(sorted[2].id, existingFar.id);
    assert.equal(sorted[3].id, recurringOriginal.id);
  });
});

// ─── countTasksByCategory & Category Badge Synchronization ──────────────────

describe('countTasksByCategory & Sidebar Badge Synchronization', () => {

  test('calculates correct total count and individual category counts', () => {
    const tasks = [
      createTask({ title: 'T1', category: 'Work' }),
      createTask({ title: 'T2', category: 'Work' }),
      createTask({ title: 'T3', category: 'Health' }),
      createTask({ title: 'T4', category: 'Finance' }),
      createTask({ title: 'T5', category: 'Study' }),
      createTask({ title: 'T6', category: 'Personal' }),
      createTask({ title: 'T7', category: 'General' }),
    ];
    const counts = countTasksByCategory(tasks);

    assert.equal(counts.all, 7);
    assert.equal(counts.Work, 2);
    assert.equal(counts.Health, 1);
    assert.equal(counts.Finance, 1);
    assert.equal(counts.Study, 1);
    assert.equal(counts.Personal, 1);
    assert.equal(counts.General, 1);
  });

  test('reports zero for categories with no matching tasks', () => {
    const tasks = [
      createTask({ title: 'T1', category: 'Work' }),
      createTask({ title: 'T2', category: 'Work' }),
    ];
    const counts = countTasksByCategory(tasks);

    assert.equal(counts.all, 2);
    assert.equal(counts.Work, 2);
    assert.equal(counts.Personal, 0);
    assert.equal(counts.Study, 0);
    assert.equal(counts.Health, 0);
    assert.equal(counts.Finance, 0);
    assert.equal(counts.General, 0);
  });

  test('empty task list returns zero for all categories and total', () => {
    const counts = countTasksByCategory([]);
    assert.equal(counts.all, 0);
    assert.equal(counts.Work, 0);
    assert.equal(counts.Personal, 0);
    assert.equal(counts.Study, 0);
    assert.equal(counts.Health, 0);
    assert.equal(counts.Finance, 0);
    assert.equal(counts.General, 0);
  });

  test('completion does not decrease category counts (completed tasks remain in category)', () => {
    const t1 = createTask({ title: 'Cardio', category: 'Health' });
    const t2 = createTask({ title: 'Vitamins', category: 'Health' });
    let tasks = [t1, t2];

    let counts = countTasksByCategory(tasks);
    assert.equal(counts.Health, 2);
    assert.equal(counts.all, 2);

    // Complete both tasks
    tasks = [toggleTaskStatus(t1), toggleTaskStatus(t2)];
    counts = countTasksByCategory(tasks);

    // Health count must remain 2 even though tasks are completed
    assert.equal(counts.Health, 2);
    assert.equal(counts.all, 2);
  });

  test('deletion decrements category counts and total correctly', () => {
    const t1 = createTask({ title: 'W1', category: 'Work' });
    const t2 = createTask({ title: 'W2', category: 'Work' });
    const t3 = createTask({ title: 'P1', category: 'Personal' });
    let tasks = [t1, t2, t3];

    let counts = countTasksByCategory(tasks);
    assert.equal(counts.Work, 2);
    assert.equal(counts.Personal, 1);
    assert.equal(counts.all, 3);

    // Delete one Work task
    tasks = deleteTask(tasks, t1.id);
    counts = countTasksByCategory(tasks);
    assert.equal(counts.Work, 1);
    assert.equal(counts.Personal, 1);
    assert.equal(counts.all, 2);

    // Delete remaining Work task
    tasks = deleteTask(tasks, t2.id);
    counts = countTasksByCategory(tasks);
    assert.equal(counts.Work, 0);
    assert.equal(counts.Personal, 1);
    assert.equal(counts.all, 1);
  });

  test('task creation and editing update category counts dynamically', () => {
    let tasks = [];
    assert.equal(countTasksByCategory(tasks).all, 0);

    // Create task
    const t1 = createTask({ title: 'Study Rust', category: 'Study' });
    tasks = [...tasks, t1];
    let counts = countTasksByCategory(tasks);
    assert.equal(counts.Study, 1);
    assert.equal(counts.all, 1);

    // Edit task to change category from Study to Work
    const updated = updateTask(t1, { category: 'Work' });
    tasks = replaceTask(tasks, updated);
    counts = countTasksByCategory(tasks);
    assert.equal(counts.Study, 0);
    assert.equal(counts.Work, 1);
    assert.equal(counts.all, 1);
  });

  test('switching task filters does not alter the underlying category totals', () => {
    const t1 = createTask({ title: 'Work pending', category: 'Work' });
    const t2 = toggleTaskStatus(createTask({ title: 'Work done', category: 'Work' }));
    const t3 = createTask({ title: 'Health pending', category: 'Health' });
    const tasks = [t1, t2, t3];

    // Global category counts before filtering
    const originalCounts = countTasksByCategory(tasks);
    assert.equal(originalCounts.all, 3);
    assert.equal(originalCounts.Work, 2);
    assert.equal(originalCounts.Health, 1);

    // Filter by pending only
    const pendingTasks = applyFilters(tasks, { status: 'pending' });
    assert.equal(pendingTasks.length, 2); // t1 and t3

    // Filter by completed only
    const completedTasks = applyFilters(tasks, { status: 'completed' });
    assert.equal(completedTasks.length, 1); // t2 only

    // Filter by category only
    const healthTasks = applyFilters(tasks, { category: 'Health' });
    assert.equal(healthTasks.length, 1);

    // The state tasks category counts remain unchanged across filter view changes
    const countsAfterFilters = countTasksByCategory(tasks);
    assert.deepEqual(countsAfterFilters, originalCounts);
  });

  test('normalises untrimmed and case-insensitive categories', () => {
    const tasks = [
      createTask({ title: 'T1', category: 'work' }),
      createTask({ title: 'T2', category: '  WORK  ' }),
      createTask({ title: 'T3', category: 'Health' }),
      { title: 'Raw Object', category: 'finance' },
      { title: 'No Category' },
    ];
    const counts = countTasksByCategory(tasks);
    assert.equal(counts.Work, 2);
    assert.equal(counts.Health, 1);
    assert.equal(counts.Finance, 1);
    assert.equal(counts.General, 1);
    assert.equal(counts.all, 5);
  });

  test('DOM badge synchronization reflects countTasksByCategory output', () => {
    const badges = {
      'cat-badge-all': { textContent: '0' },
      'cat-badge-Work': { textContent: '0' },
      'cat-badge-Personal': { textContent: '0' },
      'cat-badge-Study': { textContent: '0' },
      'cat-badge-Health': { textContent: '0' },
      'cat-badge-Finance': { textContent: '0' },
      'cat-badge-General': { textContent: '0' },
    };

    const tasks = [
      createTask({ title: 'W1', category: 'Work' }),
      createTask({ title: 'W2', category: 'Work' }),
      createTask({ title: 'H1', category: 'Health' }),
    ];

    const counts = countTasksByCategory(tasks);
    for (const [cat, count] of Object.entries(counts)) {
      const badge = badges[`cat-badge-${cat}`];
      if (badge) badge.textContent = String(count);
    }

    assert.equal(badges['cat-badge-all'].textContent, '3');
    assert.equal(badges['cat-badge-Work'].textContent, '2');
    assert.equal(badges['cat-badge-Health'].textContent, '1');
    assert.equal(badges['cat-badge-Personal'].textContent, '0');
    assert.equal(badges['cat-badge-Finance'].textContent, '0');
    assert.equal(badges['cat-badge-Study'].textContent, '0');
    assert.equal(badges['cat-badge-General'].textContent, '0');
  });
});

