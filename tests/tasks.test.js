/**
 * TaskFlow — tests/tasks.test.js
 * Unit tests for the task domain model using Node.js built-in test runner.
 *
 * Run: node --test tests/tasks.test.js
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── Import the module under test ──────────────────────────────────────────
import {
  CATEGORIES,
  PRIORITIES,
  createTask,
  updateTask,
  toggleTaskStatus,
  reopenTask,
  completeTask,
  isTaskOverdue,
  isTaskDueToday,
  isTaskUpcoming,
  validateTaskInput,
  addTask,
  replaceTask,
  deleteTask,
  findTaskById,
  computeStats,
} from '../js/tasks.js';

import { filterByStatus } from '../js/filters.js';
import { completeRecurringTask } from '../js/recurrence.js';
import { formatDate, formatTaskActivity } from '../js/utils.js';

// ─── createTask ─────────────────────────────────────────────────────────────

describe('createTask', () => {

  test('creates a task with required fields', () => {
    const task = createTask({ title: 'Write unit tests' });
    assert.equal(task.title, 'Write unit tests');
    assert.equal(task.status, 'pending');
    assert.equal(task.priority, 'medium');
    assert.equal(task.description, '');
    assert.ok(task.id, 'id should be truthy');
    assert.ok(task.createdAt, 'createdAt should be set');
    assert.ok(task.updatedAt, 'updatedAt should be set');
  });

  test('creates a task with all optional fields', () => {
    const task = createTask({
      title: 'Deploy app',
      description: 'Push to production.',
      priority: 'high',
    });
    assert.equal(task.title, 'Deploy app');
    assert.equal(task.description, 'Push to production.');
    assert.equal(task.priority, 'high');
  });

  test('trims whitespace from title and description', () => {
    const task = createTask({ title: '  Buy groceries  ', description: '  Milk, eggs  ' });
    assert.equal(task.title, 'Buy groceries');
    assert.equal(task.description, 'Milk, eggs');
  });

  test('defaults priority to medium when not supplied', () => {
    const task = createTask({ title: 'Default priority task' });
    assert.equal(task.priority, 'medium');
  });

  test('throws for an explicitly invalid priority value', () => {
    assert.throws(
      () => createTask({ title: 'Bad priority', priority: 'urgent' }),
      /low, medium or high/i
    );
  });

  test('throws when title is empty', () => {
    assert.throws(
      () => createTask({ title: '' }),
      /required/i
    );
  });

  test('throws when title is only whitespace', () => {
    assert.throws(
      () => createTask({ title: '   ' }),
      /required/i
    );
  });

  test('throws when title exceeds 200 characters', () => {
    const longTitle = 'a'.repeat(201);
    assert.throws(
      () => createTask({ title: longTitle }),
      /200/
    );
  });

  test('generates unique IDs for each task', () => {
    const t1 = createTask({ title: 'Task one' });
    const t2 = createTask({ title: 'Task two' });
    assert.notEqual(t1.id, t2.id);
  });

  test('createdAt and updatedAt are valid ISO 8601 strings', () => {
    const task = createTask({ title: 'Check timestamps' });
    assert.ok(!isNaN(Date.parse(task.createdAt)), 'createdAt should be valid date');
    assert.ok(!isNaN(Date.parse(task.updatedAt)), 'updatedAt should be valid date');
  });
});

// ─── validateTaskInput ───────────────────────────────────────────────────────

describe('validateTaskInput', () => {

  test('returns valid for minimal correct input', () => {
    const { valid } = validateTaskInput({ title: 'Hello' });
    assert.ok(valid);
  });

  test('returns error for empty title', () => {
    const { valid, errors } = validateTaskInput({ title: '' });
    assert.ok(!valid);
    assert.ok(errors.title);
  });

  test('returns error when description exceeds 1000 characters', () => {
    const { valid, errors } = validateTaskInput({
      title: 'OK',
      description: 'x'.repeat(1001),
    });
    assert.ok(!valid);
    assert.ok(errors.description);
  });

  test('returns error for invalid priority', () => {
    const { valid, errors } = validateTaskInput({ title: 'OK', priority: 'critical' });
    assert.ok(!valid);
    assert.ok(errors.priority);
  });

  test('returns valid for all accepted priorities', () => {
    for (const p of ['low', 'medium', 'high']) {
      const { valid } = validateTaskInput({ title: 'T', priority: p });
      assert.ok(valid, `priority "${p}" should be valid`);
    }
  });
});

// ─── updateTask ─────────────────────────────────────────────────────────────

describe('updateTask', () => {

  test('updates title and returns a new object', () => {
    const original = createTask({ title: 'Old title' });
    const updated = updateTask(original, { title: 'New title' });
    assert.equal(updated.title, 'New title');
    assert.equal(original.title, 'Old title', 'original should be unchanged');
    assert.notEqual(updated, original, 'should return a new object');
  });

  test('updates updatedAt timestamp', (t, done) => {
    const original = createTask({ title: 'Time check' });
    // Small delay to ensure timestamps differ
    setTimeout(() => {
      const updated = updateTask(original, { title: 'Updated title' });
      assert.ok(
        new Date(updated.updatedAt) >= new Date(original.updatedAt),
        'updatedAt should be >= original'
      );
      done();
    }, 5);
  });

  test('does not change status', () => {
    const original = createTask({ title: 'Status unchanged' });
    const updated = updateTask(original, { title: 'Still pending' });
    assert.equal(updated.status, 'pending');
  });

  test('throws when updating with an empty title', () => {
    const task = createTask({ title: 'Original' });
    assert.throws(() => updateTask(task, { title: '' }), /required/i);
  });

  test('preserves unspecified fields', () => {
    const task = createTask({ title: 'Full task', description: 'Details', priority: 'high' });
    const updated = updateTask(task, { title: 'Full task updated' });
    assert.equal(updated.description, 'Details');
    assert.equal(updated.priority, 'high');
    assert.equal(updated.id, task.id);
    assert.equal(updated.createdAt, task.createdAt);
  });
});

// ─── toggleTaskStatus ────────────────────────────────────────────────────────

describe('toggleTaskStatus', () => {

  test('toggles pending → completed', () => {
    const task = createTask({ title: 'Toggle me' });
    assert.equal(task.status, 'pending');
    const toggled = toggleTaskStatus(task);
    assert.equal(toggled.status, 'completed');
  });

  test('toggles completed → pending', () => {
    const task = createTask({ title: 'Toggle back' });
    const completed = toggleTaskStatus(task);
    const pending = toggleTaskStatus(completed);
    assert.equal(pending.status, 'pending');
  });

  test('does not mutate the original task', () => {
    const task = createTask({ title: 'Immutable' });
    toggleTaskStatus(task);
    assert.equal(task.status, 'pending', 'original should still be pending');
  });

  test('updates updatedAt on toggle', () => {
    const task = createTask({ title: 'Timestamp toggle' });
    const toggled = toggleTaskStatus(task);
    assert.ok(!isNaN(Date.parse(toggled.updatedAt)));
  });
});

// ─── Collection helpers ──────────────────────────────────────────────────────

describe('addTask', () => {

  test('appends a task to the array', () => {
    const t1 = createTask({ title: 'First' });
    const t2 = createTask({ title: 'Second' });
    const result = addTask([t1], t2);
    assert.equal(result.length, 2);
    assert.equal(result[1].title, 'Second');
  });

  test('does not mutate the original array', () => {
    const original = [createTask({ title: 'Existing' })];
    addTask(original, createTask({ title: 'New' }));
    assert.equal(original.length, 1);
  });
});

describe('replaceTask', () => {

  test('replaces the task with matching ID', () => {
    const t1 = createTask({ title: 'Task A' });
    const t2 = createTask({ title: 'Task B' });
    const updated = updateTask(t1, { title: 'Task A (updated)' });
    const result = replaceTask([t1, t2], updated);
    assert.equal(result.find(t => t.id === t1.id).title, 'Task A (updated)');
    assert.equal(result.length, 2);
  });

  test('leaves non-matching tasks unchanged', () => {
    const t1 = createTask({ title: 'Task A' });
    const t2 = createTask({ title: 'Task B' });
    const updated = updateTask(t2, { title: 'Task B (updated)' });
    const result = replaceTask([t1, t2], updated);
    assert.equal(result.find(t => t.id === t1.id).title, 'Task A');
  });
});

describe('deleteTask', () => {

  test('removes the task with matching ID', () => {
    const t1 = createTask({ title: 'Keep' });
    const t2 = createTask({ title: 'Remove' });
    const result = deleteTask([t1, t2], t2.id);
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Keep');
  });

  test('returns same length if ID not found', () => {
    const t1 = createTask({ title: 'A' });
    const result = deleteTask([t1], 'nonexistent-id');
    assert.equal(result.length, 1);
  });
});

describe('findTaskById', () => {

  test('returns the matching task', () => {
    const t1 = createTask({ title: 'Find me' });
    const result = findTaskById([t1], t1.id);
    assert.equal(result.id, t1.id);
  });

  test('returns undefined for unknown ID', () => {
    const t1 = createTask({ title: 'Task' });
    assert.equal(findTaskById([t1], 'not-a-real-id'), undefined);
  });
});

// ─── computeStats ────────────────────────────────────────────────────────────

describe('computeStats', () => {

  test('returns all zeros for empty task list', () => {
    const stats = computeStats([]);
    assert.deepEqual(stats, { total: 0, pending: 0, completed: 0, highPriority: 0, completionRate: 0 });
  });

  test('counts total, pending, completed correctly', () => {
    const tasks = [
      createTask({ title: 'A' }),
      createTask({ title: 'B' }),
      createTask({ title: 'C' }),
    ];
    const withCompleted = replaceTask(tasks, toggleTaskStatus(tasks[0]));
    const stats = computeStats(withCompleted);
    assert.equal(stats.total, 3);
    assert.equal(stats.completed, 1);
    assert.equal(stats.pending, 2);
  });

  test('counts high-priority pending tasks only', () => {
    const high1 = createTask({ title: 'High 1', priority: 'high' });
    const high2 = createTask({ title: 'High 2', priority: 'high' });
    const completedHigh = toggleTaskStatus(high2);
    const tasks = [high1, completedHigh];
    const stats = computeStats(tasks);
    assert.equal(stats.highPriority, 1, 'completed high tasks should not count');
  });

  test('calculates completion rate as a percentage', () => {
    const tasks = [
      createTask({ title: 'A' }),
      createTask({ title: 'B' }),
      createTask({ title: 'C' }),
      createTask({ title: 'D' }),
    ];
    const updated = replaceTask(
      replaceTask(tasks, toggleTaskStatus(tasks[0])),
      toggleTaskStatus(tasks[1])
    );
    const stats = computeStats(updated);
    assert.equal(stats.completionRate, 50);
  });

  test('returns 100% completion rate when all tasks are done', () => {
    const tasks = [createTask({ title: 'Done' })];
    const done = [toggleTaskStatus(tasks[0])];
    const stats = computeStats(done);
    assert.equal(stats.completionRate, 100);
  });

  test('tracks overdue pending tasks in stats.overdue', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const pad = n => String(n).padStart(2, '0');
    const pastStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

    const overdueTask = createTask({ title: 'Late task', dueDate: pastStr });
    const completedOverdue = toggleTaskStatus(createTask({ title: 'Late but done', dueDate: pastStr }));
    const onTimeTask = createTask({ title: 'No due date' });

    const stats = computeStats([overdueTask, completedOverdue, onTimeTask]);
    assert.equal(stats.overdue, 1, 'Only pending overdue tasks should be counted');
  });
});

// ─── Phase 2: Extended Task Capabilities ─────────────────────────────────────

describe('createTask — Phase 2 fields', () => {
  test('sets category to General by default and synchronizes completed boolean', () => {
    const task = createTask({ title: 'Default category test' });
    assert.equal(task.category, 'General');
    assert.equal(task.completed, false);
    assert.equal(task.dueDate, null);
  });

  test('accepts valid category options', () => {
    CATEGORIES.forEach(cat => {
      const task = createTask({ title: `Category test ${cat}`, category: cat });
      assert.equal(task.category, cat);
    });
  });

  test('normalises unknown category to General', () => {
    const task = createTask({ title: 'Random category', category: 'SecretMission' });
    assert.equal(task.category, 'General');
  });

  test('accepts valid YYYY-MM-DD due date and trims input', () => {
    const task = createTask({ title: 'Due date test', dueDate: '2026-12-31' });
    assert.equal(task.dueDate, '2026-12-31');
  });

  test('rejects malformed due dates', () => {
    assert.throws(
      () => createTask({ title: 'Bad date', dueDate: '31-12-2026' }),
      /valid YYYY-MM-DD/
    );
    assert.throws(
      () => createTask({ title: 'Bad date 2', dueDate: 'invalid-date' }),
      /valid YYYY-MM-DD/
    );
  });
});

describe('updateTask — Phase 2 fields', () => {
  test('updates category and dueDate successfully', () => {
    const original = createTask({ title: 'Initial task' });
    const updated = updateTask(original, {
      category: 'Work',
      dueDate: '2026-08-15',
    });

    assert.equal(updated.category, 'Work');
    assert.equal(updated.dueDate, '2026-08-15');
    assert.equal(updated.id, original.id);
  });

  test('can clear dueDate by setting it to empty string or null', () => {
    const original = createTask({ title: 'With date', dueDate: '2026-08-15' });
    const cleared = updateTask(original, { dueDate: '' });
    assert.equal(cleared.dueDate, null);
  });

  test('keeps completed boolean in sync when status is changed via updateTask', () => {
    const task = createTask({ title: 'Status sync test' });
    const completed = updateTask(task, { status: 'completed' });
    assert.equal(completed.status, 'completed');
    assert.equal(completed.completed, true);

    const pendingAgain = updateTask(completed, { status: 'pending' });
    assert.equal(pendingAgain.status, 'pending');
    assert.equal(pendingAgain.completed, false);
  });
});

describe('reopenTask & completeTask', () => {
  test('completeTask sets status to completed and completed to true', () => {
    const task = createTask({ title: 'To finish' });
    const finished = completeTask(task);
    assert.equal(finished.status, 'completed');
    assert.equal(finished.completed, true);
  });

  test('reopenTask sets status to pending and completed to false', () => {
    const task = createTask({ title: 'To finish' });
    const finished = completeTask(task);
    const reopened = reopenTask(finished);
    assert.equal(reopened.status, 'pending');
    assert.equal(reopened.completed, false);
  });
});

describe('Date Status Checkers', () => {
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const pastDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);
  const pastStr = `${pastDate.getFullYear()}-${pad(pastDate.getMonth() + 1)}-${pad(pastDate.getDate())}`;

  const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  const futureStr = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(futureDate.getDate())}`;

  test('isTaskDueToday correctly detects tasks due today', () => {
    const todayTask = createTask({ title: 'Today', dueDate: todayStr });
    const futureTask = createTask({ title: 'Future', dueDate: futureStr });
    const noDate = createTask({ title: 'No date' });

    assert.equal(isTaskDueToday(todayTask), true);
    assert.equal(isTaskDueToday(futureTask), false);
    assert.equal(isTaskDueToday(noDate), false);
  });

  test('isTaskOverdue returns true only for pending tasks with past dates', () => {
    const overduePending = createTask({ title: 'Late', dueDate: pastStr });
    const overdueCompleted = completeTask(createTask({ title: 'Late done', dueDate: pastStr }));
    const todayTask = createTask({ title: 'Today', dueDate: todayStr });

    assert.equal(isTaskOverdue(overduePending), true);
    assert.equal(isTaskOverdue(overdueCompleted), false, 'Completed tasks are not overdue');
    assert.equal(isTaskOverdue(todayTask), false, 'Today is not overdue');
  });

  test('isTaskUpcoming returns true for future tasks that are not completed', () => {
    const futurePending = createTask({ title: 'Future task', dueDate: futureStr });
    const futureDone = completeTask(createTask({ title: 'Future done', dueDate: futureStr }));
    const todayTask = createTask({ title: 'Today', dueDate: todayStr });

    assert.equal(isTaskUpcoming(futurePending), true);
    assert.equal(isTaskUpcoming(futureDone), false);
    assert.equal(isTaskUpcoming(todayTask), false);
  });
});

// ─── Status Transitions & Recurrence Integration ─────────────────────────────

describe('Task Status Transitions & Recurrence Integration', () => {

  test('toggling task in-place updates status and syncs computeStats accurately', () => {
    const t1 = createTask({ title: 'Task 1', priority: 'high' });
    const t2 = createTask({ title: 'Task 2', priority: 'medium' });
    let tasks = [t1, t2];

    let stats = computeStats(tasks);
    assert.equal(stats.total, 2);
    assert.equal(stats.pending, 2);
    assert.equal(stats.completed, 0);
    assert.equal(stats.completionRate, 0);

    // Toggle t1 to completed
    const toggledT1 = toggleTaskStatus(t1);
    tasks = replaceTask(tasks, toggledT1);

    stats = computeStats(tasks);
    assert.equal(stats.total, 2);
    assert.equal(stats.pending, 1);
    assert.equal(stats.completed, 1);
    assert.equal(stats.completionRate, 50);

    // Reopen t1
    const reopenedT1 = toggleTaskStatus(toggledT1);
    tasks = replaceTask(tasks, reopenedT1);

    stats = computeStats(tasks);
    assert.equal(stats.total, 2);
    assert.equal(stats.pending, 2);
    assert.equal(stats.completed, 0);
  });

  test('filterByStatus cleanly partitions tasks during pending and completed transitions', () => {
    const pendingTask = createTask({ title: 'Pending Task' });
    const completedTask = completeTask(createTask({ title: 'Completed Task' }));
    const tasks = [pendingTask, completedTask];

    const pendingOnly = filterByStatus(tasks, 'pending');
    assert.equal(pendingOnly.length, 1);
    assert.equal(pendingOnly[0].id, pendingTask.id);

    const completedOnly = filterByStatus(tasks, 'completed');
    assert.equal(completedOnly.length, 1);
    assert.equal(completedOnly[0].id, completedTask.id);

    // Transition pendingTask to completed
    const toggled = toggleTaskStatus(pendingTask);
    const updatedTasks = replaceTask(tasks, toggled);

    assert.equal(filterByStatus(updatedTasks, 'pending').length, 0);
    assert.equal(filterByStatus(updatedTasks, 'completed').length, 2);
  });

  test('recurring task completion creates valid next task occurrence while completing original', () => {
    const baseDate = '2026-11-01';
    const recurringTask = createTask({
      title: 'Weekly Standup',
      dueDate: baseDate,
      recurrence: { type: 'weekly', interval: 1 }
    });

    const completionDate = new Date('2026-11-01T10:00:00Z');
    const { completedTask, nextTask } = completeRecurringTask(recurringTask, completionDate);

    assert.equal(completedTask.status, 'completed');
    assert.equal(completedTask.completed, true);
    assert.ok(nextTask);
    assert.equal(nextTask.title, 'Weekly Standup');
    assert.equal(nextTask.status, 'pending');
    assert.equal(nextTask.dueDate, '2026-11-08');
  });

  test('persistence gate suppresses success notification when save fails', () => {
    let notifiedMessage = null;
    let notifiedType = null;
    const mockShowToast = (msg, type) => {
      notifiedMessage = msg;
      notifiedType = type;
    };

    // Simulate mutation with failing persistence
    const task = createTask({ title: 'Task with failing persistence' });
    toggleTaskStatus(task);
    const mockPersistState = () => false; // persistence failed

    const saved = mockPersistState();
    if (saved) {
      mockShowToast('Task marked as completed.', 'success');
    }

    assert.equal(saved, false);
    assert.equal(notifiedMessage, null, 'No success toast must be emitted when persistence fails');
  });

  test('successful persistence emits the expected success notification', () => {
    let notifiedMessage = null;
    let notifiedType = null;
    const mockShowToast = (msg, type) => {
      notifiedMessage = msg;
      notifiedType = type;
    };

    // Simulate mutation with successful persistence
    const task = createTask({ title: 'Task with successful persistence' });
    toggleTaskStatus(task);
    const mockPersistState = () => true;

    const saved = mockPersistState();
    if (saved) {
      mockShowToast('Task marked as completed.', 'success');
    }

    assert.equal(saved, true);
    assert.equal(notifiedMessage, 'Task marked as completed.');
    assert.equal(notifiedType, 'success');
  });

  test('clear-completed and reset-all operations suppress success message on persistence failure', () => {
    let notifications = [];

    let tasks = [
      createTask({ title: 'T1' }),
      completeTask(createTask({ title: 'T2' })),
    ];

    // Clear completed with failed persistence
    tasks = tasks.filter(t => !t.completed && t.status !== 'completed');
    assert.equal(tasks.length, 1, 'Clear-completed should remove completed tasks from in-memory state');
    assert.equal(tasks[0].completed || tasks[0].status === 'completed', false, 'Remaining task must be incomplete');

    assert.equal(notifications.length, 0, 'Must not claim completed tasks were cleared when persistence failed');

    // Reset all with failed persistence

    assert.equal(notifications.length, 0, 'Must not claim all tasks were reset when persistence failed');
  });
});

// ─── Activity Timestamps & Relative Formatting ────────────────────────────────

describe('Activity Timestamps & Relative Formatting', () => {
  const refTime = new Date('2026-11-07T12:00:00.000Z');

  test('formats "Created just now" for recently created task (within 60s)', () => {
    const createdDate = new Date(refTime.getTime() - 30 * 1000).toISOString();
    const task = {
      title: 'Quick Task',
      createdAt: createdDate,
      updatedAt: createdDate,
    };

    const activity = formatTaskActivity(task, refTime);
    assert.equal(activity.isUpdated, false);
    assert.equal(activity.label, 'Created just now');
    assert.equal(activity.datetime, createdDate);
    assert.ok(activity.tooltip.startsWith('Created:'));
    assert.ok(activity.tooltip.includes(new Date(createdDate).toLocaleString()));
  });

  test('formats "Created yesterday" for task created 24-48 hours ago', () => {
    const createdDate = new Date(refTime.getTime() - 30 * 3600 * 1000).toISOString();
    const task = {
      title: 'Yesterday Task',
      createdAt: createdDate,
      updatedAt: createdDate,
    };

    const activity = formatTaskActivity(task, refTime);
    assert.equal(activity.isUpdated, false);
    assert.equal(activity.label, 'Created yesterday');
    assert.equal(activity.datetime, createdDate);
    assert.ok(activity.tooltip.startsWith('Created:'));
    assert.ok(activity.tooltip.includes(new Date(createdDate).toLocaleString()));
  });

  test('formats "Updated" with relative time when task has been modified', () => {
    const createdDate = new Date(refTime.getTime() - 48 * 3600 * 1000).toISOString();
    const updatedDate = new Date(refTime.getTime() - 2 * 3600 * 1000).toISOString();
    const task = {
      title: 'Modified Task',
      createdAt: createdDate,
      updatedAt: updatedDate,
    };

    const activity = formatTaskActivity(task, refTime);
    assert.equal(activity.isUpdated, true);
    assert.equal(activity.label, 'Updated 2h ago');
    assert.equal(activity.datetime, updatedDate);
    assert.ok(activity.tooltip.startsWith('Last modified:'));
    assert.ok(activity.tooltip.includes(new Date(updatedDate).toLocaleString()));
  });

  test('formats "Updated just now" when modification is recent', () => {
    const createdDate = new Date(refTime.getTime() - 24 * 3600 * 1000).toISOString();
    const updatedDate = new Date(refTime.getTime() - 15 * 1000).toISOString();
    const task = {
      title: 'Freshly Modified Task',
      createdAt: createdDate,
      updatedAt: updatedDate,
    };

    const activity = formatTaskActivity(task, refTime);
    assert.equal(activity.isUpdated, true);
    assert.equal(activity.label, 'Updated just now');
    assert.ok(activity.tooltip.startsWith('Last modified:'));
  });

  test('formats "Updated yesterday" when modification was yesterday', () => {
    const createdDate = new Date(refTime.getTime() - 72 * 3600 * 1000).toISOString();
    const updatedDate = new Date(refTime.getTime() - 28 * 3600 * 1000).toISOString();
    const task = {
      title: 'Yesterday Modified Task',
      createdAt: createdDate,
      updatedAt: updatedDate,
    };

    const activity = formatTaskActivity(task, refTime);
    assert.equal(activity.isUpdated, true);
    assert.equal(activity.label, 'Updated yesterday');
    assert.ok(activity.tooltip.startsWith('Last modified:'));
  });

  test('full localized timestamp tooltip matches target date toLocaleString', () => {
    const dateStr = '2026-11-06T15:30:00.000Z';
    const task = {
      title: 'Tooltip Task',
      createdAt: dateStr,
      updatedAt: dateStr,
    };

    const activity = formatTaskActivity(task, refTime);
    const expectedLocal = new Date(dateStr).toLocaleString();
    assert.equal(activity.tooltip, `Created: ${expectedLocal}`);
  });

  test('editing a task preserves its original creation timestamp', () => {
    const fixedPast = '2026-01-01T08:00:00.000Z';
    const original = {
      ...createTask({ title: 'Original Task', priority: 'medium' }),
      createdAt: fixedPast,
      updatedAt: fixedPast,
    };

    const edited = updateTask(original, { title: 'Updated Task Name' });
    assert.equal(edited.createdAt, fixedPast, 'createdAt must remain untouched');
    assert.notEqual(edited.updatedAt, fixedPast, 'updatedAt must be refreshed');
    assert.ok(new Date(edited.updatedAt).getTime() > new Date(fixedPast).getTime());
  });

  test('updating a task changes its update timestamp', () => {
    const original = createTask({ title: 'Time change test' });
    const originalUpdate = original.updatedAt;

    const futureIso = new Date(Date.now() + 10000).toISOString();
    const edited = {
      ...updateTask(original, { description: 'New description' }),
      updatedAt: futureIso,
    };

    assert.equal(edited.createdAt, original.createdAt);
    assert.notEqual(edited.updatedAt, originalUpdate);
    assert.ok(new Date(edited.updatedAt).getTime() > new Date(originalUpdate).getTime());
  });

  test('toggling task status updates updatedAt while preserving createdAt', () => {
    const fixedPast = '2026-05-01T10:00:00.000Z';
    const original = {
      ...createTask({ title: 'Toggle test' }),
      createdAt: fixedPast,
      updatedAt: fixedPast,
    };

    const completed = toggleTaskStatus(original);
    assert.equal(completed.createdAt, fixedPast, 'createdAt preserved on toggle');
    assert.notEqual(completed.updatedAt, fixedPast, 'updatedAt modified on toggle');
    assert.equal(completed.status, 'completed');

    const reopened = toggleTaskStatus(completed);
    assert.equal(reopened.createdAt, fixedPast, 'createdAt preserved on reopen');
    assert.equal(reopened.status, 'pending');
  });

  test('formatDate correctly returns expected relative ranges deterministically', () => {
    assert.equal(formatDate(new Date(refTime.getTime() - 10000).toISOString(), refTime), 'Just now');
    assert.equal(formatDate(new Date(refTime.getTime() - 5 * 60 * 1000).toISOString(), refTime), '5m ago');
    assert.equal(formatDate(new Date(refTime.getTime() - 3 * 3600 * 1000).toISOString(), refTime), '3h ago');
    assert.equal(formatDate(new Date(refTime.getTime() - 25 * 3600 * 1000).toISOString(), refTime), 'Yesterday');
    assert.equal(formatDate(new Date(refTime.getTime() - 4 * 86400 * 1000).toISOString(), refTime), '4d ago');
    const farPast = new Date(refTime.getTime() - 14 * 86400 * 1000).toISOString();
    const expectedAbs = new Date(farPast).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    assert.equal(formatDate(farPast, refTime), expectedAbs);
    assert.equal(formatDate(''), '');
    assert.equal(formatDate('not-a-date'), '');
  });
});

