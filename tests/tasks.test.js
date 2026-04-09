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
  createTask,
  updateTask,
  toggleTaskStatus,
  validateTaskInput,
  addTask,
  replaceTask,
  deleteTask,
  findTaskById,
  computeStats,
} from '../js/tasks.js';

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
});
