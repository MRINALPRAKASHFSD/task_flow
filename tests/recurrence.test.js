/**
 * TaskFlow — tests/recurrence.test.js
 * Unit test suite for recurring task engine, intervals, month-end clamps, and leap years.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateRecurrenceRule,
  calculateNextDueDate,
  completeRecurringTask,
  stopTaskRecurrence,
  formatRecurrenceLabel,
} from '../js/recurrence.js';

describe('Recurrence Rule Validation', () => {
  test('defaults empty or null rule to type "none"', () => {
    assert.equal(validateRecurrenceRule(null).type, 'none');
    assert.equal(validateRecurrenceRule({}).type, 'none');
    assert.equal(validateRecurrenceRule({ type: 'invalid' }).type, 'none');
  });

  test('validates supported recurrence patterns with defaults', () => {
    const daily = validateRecurrenceRule({ type: 'daily' });
    assert.equal(daily.type, 'daily');
    assert.equal(daily.interval, 1);

    const weekly = validateRecurrenceRule({ type: 'weekly', interval: 2, daysOfWeek: [1, 3] });
    assert.equal(weekly.type, 'weekly');
    assert.equal(weekly.interval, 2);
    assert.deepEqual(weekly.daysOfWeek, [1, 3]);
  });
});

describe('calculateNextDueDate Progressions', () => {
  test('daily advances by 1 day or custom interval', () => {
    assert.equal(calculateNextDueDate('2026-11-05', { type: 'daily', interval: 1 }), '2026-11-06');
    assert.equal(calculateNextDueDate('2026-11-05', { type: 'daily', interval: 3 }), '2026-11-08');
  });

  test('weekdays skips Saturday and Sunday', () => {
    // Thursday 2026-11-05 -> Friday 2026-11-06
    assert.equal(calculateNextDueDate('2026-11-05', { type: 'weekdays' }), '2026-11-06');
    // Friday 2026-11-06 -> Monday 2026-11-09
    assert.equal(calculateNextDueDate('2026-11-06', { type: 'weekdays' }), '2026-11-09');
  });

  test('weekly advances by 7 days or specified day of week', () => {
    assert.equal(calculateNextDueDate('2026-11-05', { type: 'weekly', interval: 1 }), '2026-11-12');
    assert.equal(calculateNextDueDate('2026-11-05', { type: 'weekly', interval: 2 }), '2026-11-19');
  });

  test('monthly clamps month-end dates accurately (non-leap vs leap year)', () => {
    // Jan 31, 2025 -> Feb 28, 2025 (non-leap year)
    assert.equal(calculateNextDueDate('2025-01-31', { type: 'monthly', interval: 1 }), '2025-02-28');

    // Jan 31, 2024 -> Feb 29, 2024 (leap year)
    assert.equal(calculateNextDueDate('2024-01-31', { type: 'monthly', interval: 1 }), '2024-02-29');

    // March 31, 2026 -> April 30, 2026 (April has 30 days)
    assert.equal(calculateNextDueDate('2026-03-31', { type: 'monthly', interval: 1 }), '2026-04-30');
  });

  test('yearly handles leap year Feb 29 progression', () => {
    // Feb 29, 2024 -> Feb 28, 2025
    assert.equal(calculateNextDueDate('2024-02-29', { type: 'yearly', interval: 1 }), '2025-02-28');
    // Nov 5, 2026 -> Nov 5, 2027
    assert.equal(calculateNextDueDate('2026-11-05', { type: 'yearly', interval: 1 }), '2027-11-05');
  });

  test('respects endDate cutoff by returning null when exceeded', () => {
    const rule = { type: 'daily', interval: 1, endDate: '2026-11-06' };
    assert.equal(calculateNextDueDate('2026-11-05', rule), '2026-11-06');
    assert.equal(calculateNextDueDate('2026-11-06', rule), null);
  });
});

describe('completeRecurringTask Lifecycle', () => {
  const recurringTask = {
    id: 'parent-task-1',
    title: 'Submit Weekly Standup Notes',
    description: 'Summarize work completed',
    priority: 'high',
    category: 'Work',
    status: 'pending',
    completed: false,
    dueDate: '2026-11-05',
    recurrence: { type: 'weekly', interval: 1 },
    tags: ['dev', 'weekly'],
  };

  test('completes current task and spawns next occurrence', () => {
    const { completedTask, nextTask } = completeRecurringTask(recurringTask);

    assert.equal(completedTask.status, 'completed');
    assert.equal(completedTask.completed, true);
    assert.equal(completedTask.id, 'parent-task-1');

    assert.ok(nextTask);
    assert.notEqual(nextTask.id, 'parent-task-1');
    assert.equal(nextTask.status, 'pending');
    assert.equal(nextTask.completed, false);
    assert.equal(nextTask.dueDate, '2026-11-12');
    assert.equal(nextTask.recurringParentId, 'parent-task-1');
    assert.equal(nextTask.title, 'Submit Weekly Standup Notes');
    assert.deepEqual(nextTask.tags, ['dev', 'weekly']);
  });

  test('does not spawn next task when recurrence type is "none"', () => {
    const nonRecurring = { ...recurringTask, recurrence: { type: 'none' } };
    const { completedTask, nextTask } = completeRecurringTask(nonRecurring);

    assert.equal(completedTask.status, 'completed');
    assert.equal(nextTask, null);
  });

  test('stopTaskRecurrence disables recurrence rule', () => {
    const stopped = stopTaskRecurrence(recurringTask);
    assert.equal(stopped.recurrence.type, 'none');
  });

  test('completes recurring task without dueDate by advancing from referenceDate', () => {
    const taskWithoutDate = {
      id: 'task-no-date',
      title: 'Water Plants',
      status: 'pending',
      completed: false,
      dueDate: null,
      recurrence: { type: 'daily', interval: 2 },
    };
    const ref = new Date(2026, 10, 5); // 2026-11-05
    const { completedTask, nextTask } = completeRecurringTask(taskWithoutDate, ref);

    assert.equal(completedTask.status, 'completed');
    assert.ok(nextTask);
    assert.equal(nextTask.dueDate, '2026-11-07');
    assert.equal(nextTask.status, 'pending');
  });

  test('resets completed subtasks on newly spawned recurring task instance', () => {
    const taskWithSubs = {
      ...recurringTask,
      subtasks: [
        { id: 's1', title: 'Prep doc', completed: true },
        { id: 's2', title: 'Send email', completed: true },
      ],
    };
    const { nextTask } = completeRecurringTask(taskWithSubs);
    assert.ok(nextTask);
    assert.equal(nextTask.subtasks.length, 2);
    assert.equal(nextTask.subtasks[0].completed, false);
    assert.equal(nextTask.subtasks[1].completed, false);
    assert.notEqual(nextTask.subtasks[0].id, 's1');
  });

  test('formatRecurrenceLabel formats human-readable text', () => {
    assert.equal(formatRecurrenceLabel({ type: 'daily' }), 'Every day');
    assert.equal(formatRecurrenceLabel({ type: 'daily', interval: 2 }), 'Every 2 days');
    assert.equal(formatRecurrenceLabel({ type: 'weekdays' }), 'Every weekday (Mon–Fri)');
    assert.equal(formatRecurrenceLabel({ type: 'weekly' }), 'Every week');
    assert.equal(formatRecurrenceLabel({ type: 'monthly' }), 'Every month');
    assert.equal(formatRecurrenceLabel({ type: 'yearly' }), 'Every year');
    assert.equal(formatRecurrenceLabel({ type: 'custom', interval: 5 }), 'Every 5 days');
    assert.equal(formatRecurrenceLabel({ type: 'none' }), 'Does not repeat');
  });
});

