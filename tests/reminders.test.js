/**
 * TaskFlow — tests/reminders.test.js
 * Comprehensive unit tests for Smart Reminders engine:
 * permission flow, due-soon detection, overdue alerts, deduplication, and preferences.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  loadReminderPreferences,
  saveReminderPreferences,
  loadNotifiedReminders,
  saveNotifiedReminders,
  clearNotifiedReminders,
  getTaskDueDateTime,
  isDueSoon,
  isOverdueReminder,
  buildReminderKey,
  checkReminders,
  DEFAULT_REMINDER_PREFERENCES,
} from '../js/reminders.js';

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

describe('Smart Reminders — Notification API & Permission Flow', () => {
  beforeEach(() => {
    delete globalThis.window;
  });

  test('isNotificationSupported returns false in headless node environment', () => {
    assert.equal(isNotificationSupported(), false);
  });

  test('getNotificationPermission returns unsupported when Notification is absent', () => {
    assert.equal(getNotificationPermission(), 'unsupported');
  });

  test('requestNotificationPermission returns unsupported when Notification is absent', async () => {
    const res = await requestNotificationPermission();
    assert.equal(res, 'unsupported');
  });

  test('handles mocked window.Notification correctly', async () => {
    globalThis.window = {
      Notification: {
        permission: 'default',
        requestPermission: async () => 'granted',
      },
    };

    assert.equal(isNotificationSupported(), true);
    assert.equal(getNotificationPermission(), 'default');

    const perm = await requestNotificationPermission();
    assert.equal(perm, 'granted');

    delete globalThis.window;
  });
});

describe('Smart Reminders — Preferences & Storage', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  test('loads default preferences when storage is empty', () => {
    const prefs = loadReminderPreferences(mockStorage);
    assert.deepEqual(prefs, DEFAULT_REMINDER_PREFERENCES);
  });

  test('saves and retrieves updated preferences', () => {
    const custom = {
      browserNotifications: true,
      inAppAlerts: true,
      dueSoonHours: 12,
    };
    const saved = saveReminderPreferences(custom, mockStorage);
    assert.equal(saved, true);

    const loaded = loadReminderPreferences(mockStorage);
    assert.equal(loaded.browserNotifications, true);
    assert.equal(loaded.dueSoonHours, 12);
  });

  test('manages notified reminders deduplication set', () => {
    const keys = new Set(['task-1:2026-11-05:due_soon', 'task-2:2026-11-04:overdue']);
    saveNotifiedReminders(keys, mockStorage);

    const loaded = loadNotifiedReminders(mockStorage);
    assert.equal(loaded.size, 2);
    assert.equal(loaded.has('task-1:2026-11-05:due_soon'), true);

    clearNotifiedReminders(mockStorage);
    const cleared = loadNotifiedReminders(mockStorage);
    assert.equal(cleared.size, 0);
  });
});

describe('Smart Reminders — Due-Date & Time Calculations', () => {
  test('getTaskDueDateTime parses standard date with default 09:00 time', () => {
    const task = { dueDate: '2026-11-10' };
    const dt = getTaskDueDateTime(task);
    assert.ok(dt instanceof Date);
    assert.equal(dt.getFullYear(), 2026);
    assert.equal(dt.getMonth(), 10); // November
    assert.equal(dt.getDate(), 10);
    assert.equal(dt.getHours(), 9);
    assert.equal(dt.getMinutes(), 0);
  });

  test('getTaskDueDateTime parses custom reminderTime', () => {
    const task = { dueDate: '2026-11-10', reminderTime: '15:45' };
    const dt = getTaskDueDateTime(task);
    assert.equal(dt.getHours(), 15);
    assert.equal(dt.getMinutes(), 45);
  });

  test('isDueSoon identifies tasks within 24 hours of reference date', () => {
    const reference = new Date(2026, 10, 5, 8, 0, 0); // Nov 5, 08:00
    const taskSoon = {
      id: 't1',
      title: 'Review PR',
      status: 'pending',
      dueDate: '2026-11-05', // Today at 09:00 -> 1 hour away
      reminderTime: '09:00',
    };
    const taskLater = {
      id: 't2',
      title: 'Plan Sprint',
      status: 'pending',
      dueDate: '2026-11-10', // 5 days away
    };
    const taskDone = {
      id: 't3',
      title: 'Completed task',
      completed: true,
      dueDate: '2026-11-05',
    };

    assert.equal(isDueSoon(taskSoon, reference, 24), true);
    assert.equal(isDueSoon(taskLater, reference, 24), false);
    assert.equal(isDueSoon(taskDone, reference, 24), false);
  });

  test('isOverdueReminder identifies pending tasks past their due time', () => {
    const reference = new Date(2026, 10, 5, 10, 0, 0); // Nov 5, 10:00
    const overdueTask = {
      id: 't1',
      status: 'pending',
      dueDate: '2026-11-05',
      reminderTime: '09:00', // 1 hour past
    };
    const futureTask = {
      id: 't2',
      status: 'pending',
      dueDate: '2026-11-05',
      reminderTime: '14:00', // 4 hours in future
    };

    assert.equal(isOverdueReminder(overdueTask, reference), true);
    assert.equal(isOverdueReminder(futureTask, reference), false);
  });
});

describe('Smart Reminders — Notification Deduplication & Dispatching', () => {
  test('checkReminders emits notifications and prevents duplicate triggers', () => {
    const mockStorage = new MockStorage();
    const reference = new Date(2026, 10, 5, 8, 30, 0);

    const tasks = [
      { id: '1', title: 'Morning Standup', status: 'pending', dueDate: '2026-11-05', reminderTime: '09:00' },
      { id: '2', title: 'Yesterday report', status: 'pending', dueDate: '2026-11-04', reminderTime: '17:00' },
      { id: '3', title: 'Next week kickoff', status: 'pending', dueDate: '2026-11-12' },
    ];

    const inAppNotes = [];
    const browserNotes = [];

    const result1 = checkReminders(tasks, {
      referenceDate: reference,
      storage: mockStorage,
      preferences: { browserNotifications: true, inAppAlerts: true, dueSoonHours: 24 },
      onInAppNotify: (n) => inAppNotes.push(n),
      onBrowserNotify: (n) => browserNotes.push(n),
    });

    assert.equal(result1.dueSoonTasks.length, 1);
    assert.equal(result1.overdueTasks.length, 1);
    assert.equal(result1.newNotifications.length, 2);
    assert.equal(inAppNotes.length, 2);
    assert.equal(browserNotes.length, 2);

    // Second run with the same storage must NOT duplicate notifications
    const inAppNotes2 = [];
    const result2 = checkReminders(tasks, {
      referenceDate: reference,
      storage: mockStorage,
      preferences: { browserNotifications: true, inAppAlerts: true, dueSoonHours: 24 },
      onInAppNotify: (n) => inAppNotes2.push(n),
    });

    assert.equal(result2.newNotifications.length, 0);
    assert.equal(inAppNotes2.length, 0);
  });
});

