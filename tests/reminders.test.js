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
  pruneNotifiedReminders,
  buildReminderKey,
  getTaskDueDateTime,
  isDueSoon,
  isOverdueReminder,
  checkReminders,
  DEFAULT_REMINDER_PREFERENCES,
  parseTimeToMinutes,
  isQuietHours,
  isPriorityEligible,
  PRIORITY_THRESHOLDS,
  buildOverdueBatchKey,
  generateDailyBriefing,
  STORAGE_KEY_DAILY_BRIEFING,
  isSchedulerRunning,
  startReminderScheduler,
  stopReminderScheduler,
  STORAGE_KEY_REMINDER_PREFS,
  normalizeTimeString,
  normalizeDueSoonHours,
} from '../js/reminders.js';
import { NotificationCenter } from '../js/notifications.js';

class MockStorage {
  constructor(shouldThrow = false) {
    this.store = new Map();
    this.shouldThrow = shouldThrow;
  }
  getItem(key) {
    if (this.shouldThrow) throw new Error('Storage read failure');
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    if (this.shouldThrow) throw new Error('Storage write failure');
    this.store.set(key, String(value));
  }
  removeItem(key) {
    if (this.shouldThrow) throw new Error('Storage remove failure');
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

  test('safely falls back to valid defaults when preferences JSON is corrupt or invalid', () => {
    mockStorage.setItem(STORAGE_KEY_REMINDER_PREFS, '{ corrupt json invalid');
    const prefs = loadReminderPreferences(mockStorage);
    assert.deepEqual(prefs, DEFAULT_REMINDER_PREFERENCES);

    mockStorage.setItem(STORAGE_KEY_REMINDER_PREFS, JSON.stringify('not-an-object'));
    const prefs2 = loadReminderPreferences(mockStorage);
    assert.deepEqual(prefs2, DEFAULT_REMINDER_PREFERENCES);
  });

  test('sanitizes and bounds invalid preference values cleanly', () => {
    mockStorage.setItem(STORAGE_KEY_REMINDER_PREFS, JSON.stringify({
      browserNotifications: 'not-a-bool',
      dueSoonHours: -5,
      quietHoursEnabled: 'truthy',
      quietHoursStart: '25:00', // out of range 24h
      quietHoursEnd: '99:99', // out of range 24h
      priorityFilter: 'unknown-filter',
      dailyBriefingEnabled: false,
    }));

    const loaded = loadReminderPreferences(mockStorage);
    assert.equal(loaded.browserNotifications, true);
    assert.equal(loaded.dueSoonHours, 24);
    assert.equal(loaded.quietHoursEnabled, true);
    assert.equal(loaded.quietHoursStart, '22:00');
    assert.equal(loaded.quietHoursEnd, '08:00');
    assert.equal(loaded.priorityFilter, 'all');
    assert.equal(loaded.dailyBriefingEnabled, false);
  });

  test('normalizes time strings and bounds due-soon hours accurately', () => {
    assert.equal(normalizeTimeString('9:05'), '09:05');
    assert.equal(normalizeTimeString('23:59'), '23:59');
    assert.equal(normalizeTimeString('0:00'), '00:00');
    assert.equal(normalizeTimeString('24:00', '22:00'), '22:00');
    assert.equal(normalizeTimeString('12:60', '22:00'), '22:00');
    assert.equal(normalizeTimeString('invalid', '22:00'), '22:00');
    assert.equal(normalizeTimeString(null, '22:00'), '22:00');

    assert.equal(normalizeDueSoonHours(12), 12);
    assert.equal(normalizeDueSoonHours(0), 24);
    assert.equal(normalizeDueSoonHours(-10), 24);
    assert.equal(normalizeDueSoonHours(500), 168);
    assert.equal(normalizeDueSoonHours(0.8), 1);
    assert.equal(normalizeDueSoonHours(NaN), 24);
    assert.equal(normalizeDueSoonHours(Infinity), 24);
  });

  test('saveReminderPreferences safely handles storage write failure and returns false', () => {
    const failingStorage = new MockStorage(true);
    const result = saveReminderPreferences({ browserNotifications: true }, failingStorage);
    assert.equal(result, false);

    assert.equal(saveReminderPreferences(null, mockStorage), false);
    assert.equal(saveReminderPreferences({}, null), false);
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

  test('buildReminderKey constructs unique deterministic keys with optional reminderTime', () => {
    // Backwards-compatible 3-arg call
    const key1 = buildReminderKey('task-1', '2026-11-05', 'due_soon');
    assert.equal(key1, 'task-1:2026-11-05:due_soon');

    // 4-arg call with explicit reminderTime
    const key2 = buildReminderKey('task-1', '2026-11-05', 'due_soon', '14:30');
    assert.equal(key2, 'task-1:2026-11-05:14:30:due_soon');

    // Null dueDate fallback
    const key3 = buildReminderKey('task-2', null, 'overdue');
    assert.equal(key3, 'task-2:none:overdue');
  });

  test('pruneNotifiedReminders cleans up keys for completed or deleted tasks', () => {
    const storage = new MockStorage();
    const initialKeys = new Set([
      'task-active:2026-11-05:due_soon',
      'task-completed:2026-11-05:due_soon',
      'task-deleted:2026-11-04:overdue',
    ]);
    saveNotifiedReminders(initialKeys, storage);

    const tasks = [
      { id: 'task-active', dueDate: '2026-11-05', status: 'pending', completed: false },
      { id: 'task-completed', dueDate: '2026-11-05', status: 'completed', completed: true },
    ];

    const pruned = pruneNotifiedReminders(tasks, null, storage);
    assert.equal(pruned.size, 1);
    assert.equal(pruned.has('task-active:2026-11-05:due_soon'), true);
    assert.equal(pruned.has('task-completed:2026-11-05:due_soon'), false);
    assert.equal(pruned.has('task-deleted:2026-11-04:overdue'), false);

    // Verify written to storage
    const loaded = loadNotifiedReminders(storage);
    assert.equal(loaded.size, 1);
    assert.equal(loaded.has('task-active:2026-11-05:due_soon'), true);
  });
});

describe('Smart Reminders — Quiet Hours Logic & Suppression', () => {
  test('parseTimeToMinutes parses valid 24-hour time strings into minutes', () => {
    assert.equal(parseTimeToMinutes('00:00'), 0);
    assert.equal(parseTimeToMinutes('08:30'), 510);
    assert.equal(parseTimeToMinutes('22:00'), 1320);
    assert.equal(parseTimeToMinutes('23:59'), 1439);

    // Invalid formats return null
    assert.equal(parseTimeToMinutes('24:00'), null);
    assert.equal(parseTimeToMinutes('12:60'), null);
    assert.equal(parseTimeToMinutes('invalid'), null);
    assert.equal(parseTimeToMinutes(null), null);
  });

  test('isQuietHours returns false when quietHoursEnabled is false', () => {
    const prefs = {
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };
    const midnight = new Date(2026, 10, 5, 0, 30);
    assert.equal(isQuietHours(midnight, prefs), false);
  });

  test('isQuietHours correctly evaluates overnight intervals (22:00 to 08:00)', () => {
    const prefs = {
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };

    assert.equal(isQuietHours(new Date(2026, 10, 5, 22, 0), prefs), true);
    assert.equal(isQuietHours(new Date(2026, 10, 5, 23, 30), prefs), true);
    assert.equal(isQuietHours(new Date(2026, 10, 5, 3, 15), prefs), true);
    assert.equal(isQuietHours(new Date(2026, 10, 5, 7, 59), prefs), true);

    // Outside quiet hours
    assert.equal(isQuietHours(new Date(2026, 10, 5, 8, 0), prefs), false);
    assert.equal(isQuietHours(new Date(2026, 10, 5, 12, 0), prefs), false);
    assert.equal(isQuietHours(new Date(2026, 10, 5, 21, 59), prefs), false);
  });

  test('isQuietHours correctly evaluates same-day intervals (13:00 to 14:00)', () => {
    const prefs = {
      quietHoursEnabled: true,
      quietHoursStart: '13:00',
      quietHoursEnd: '14:00',
    };

    assert.equal(isQuietHours(new Date(2026, 10, 5, 12, 59), prefs), false);
    assert.equal(isQuietHours(new Date(2026, 10, 5, 13, 0), prefs), true);
    assert.equal(isQuietHours(new Date(2026, 10, 5, 13, 30), prefs), true);
    assert.equal(isQuietHours(new Date(2026, 10, 5, 14, 0), prefs), false);
  });

  test('isQuietHours returns false when start and end times are equal', () => {
    const prefs = {
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '22:00',
    };
    assert.equal(isQuietHours(new Date(2026, 10, 5, 22, 0), prefs), false);
  });

  test('checkReminders suppresses toasts during quiet hours while persisting to NotificationCenter', () => {
    const mockStorage = new MockStorage();
    const notifCenter = new NotificationCenter(mockStorage);
    const inAppNotes = [];
    const browserNotes = [];

    // Reference time: 23:30 (inside 22:00-08:00 quiet hours)
    const refDate = new Date(2026, 10, 5, 23, 30, 0);

    const tasks = [
      { id: 't1', title: 'Late Standup', status: 'pending', dueDate: '2026-11-06', reminderTime: '09:00' },
    ];

    const result = checkReminders(tasks, {
      referenceDate: refDate,
      storage: mockStorage,
      notificationCenter: notifCenter,
      preferences: {
        browserNotifications: true,
        inAppAlerts: true,
        dueSoonHours: 24,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        priorityFilter: 'all',
      },
      onInAppNotify: (n) => inAppNotes.push(n),
      onBrowserNotify: (n) => browserNotes.push(n),
    });

    assert.equal(result.inQuietHours, true);
    assert.equal(result.newNotifications.length, 1);
    // Callbacks suppressed!
    assert.equal(inAppNotes.length, 0);
    assert.equal(browserNotes.length, 0);

    // But persisted into NotificationCenter!
    assert.equal(notifCenter.getNotifications().length, 1);
    assert.equal(notifCenter.getUnreadCount(), 1);

    // And marked in notifiedKeys to prevent backlog burst when quiet hours end
    const loadedKeys = loadNotifiedReminders(mockStorage);
    assert.equal(loadedKeys.size, 1);

    // Subsequent check at 08:30 (quiet hours ended) does NOT burst toast
    const daytimeDate = new Date(2026, 10, 6, 8, 30, 0);
    const inAppNotes2 = [];
    const result2 = checkReminders(tasks, {
      referenceDate: daytimeDate,
      storage: mockStorage,
      notificationCenter: notifCenter,
      preferences: {
        browserNotifications: true,
        inAppAlerts: true,
        dueSoonHours: 24,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        priorityFilter: 'all',
      },
      onInAppNotify: (n) => inAppNotes2.push(n),
    });

    assert.equal(result2.inQuietHours, false);
    assert.equal(result2.newNotifications.length, 0);
    assert.equal(inAppNotes2.length, 0, 'Must not burst stale notifications after quiet hours end');
  });
});

describe('Smart Reminders — Priority Filtering', () => {
  test('isPriorityEligible determines threshold eligibility accurately', () => {
    assert.equal(isPriorityEligible('high', 'high_only'), true);
    assert.equal(isPriorityEligible('medium', 'high_only'), false);
    assert.equal(isPriorityEligible('low', 'high_only'), false);

    assert.equal(isPriorityEligible('high', 'medium_high'), true);
    assert.equal(isPriorityEligible('medium', 'medium_high'), true);
    assert.equal(isPriorityEligible('low', 'medium_high'), false);

    assert.equal(isPriorityEligible('high', 'all'), true);
    assert.equal(isPriorityEligible('medium', 'all'), true);
    assert.equal(isPriorityEligible('low', 'all'), true);
  });

  test('checkReminders filters tasks according to priority threshold', () => {
    const mockStorage = new MockStorage();
    const reference = new Date(2026, 10, 5, 8, 0, 0);

    const tasks = [
      { id: '1', title: 'Low priority task', status: 'pending', priority: 'low', dueDate: '2026-11-05', reminderTime: '09:00' },
      { id: '2', title: 'Med priority task', status: 'pending', priority: 'medium', dueDate: '2026-11-05', reminderTime: '09:00' },
      { id: '3', title: 'High priority task', status: 'pending', priority: 'high', dueDate: '2026-11-05', reminderTime: '09:00' },
    ];

    // Case 1: high_only
    const resHigh = checkReminders(tasks, {
      referenceDate: reference,
      storage: mockStorage,
      preferences: { inAppAlerts: true, priorityFilter: 'high_only', dueSoonHours: 24 },
    });
    assert.equal(resHigh.newNotifications.length, 1);
    assert.equal(resHigh.newNotifications[0].taskId, '3');

    // Case 2: medium_high on a fresh storage
    const storage2 = new MockStorage();
    const resMed = checkReminders(tasks, {
      referenceDate: reference,
      storage: storage2,
      preferences: { inAppAlerts: true, priorityFilter: 'medium_high', dueSoonHours: 24 },
    });
    assert.equal(resMed.newNotifications.length, 2);
    assert.deepEqual(resMed.newNotifications.map(n => n.taskId).sort(), ['2', '3']);
  });
});

describe('Smart Reminders — Edit Invalidation & Reopening Workflows', () => {
  test('modifying reminderTime invalidates old reminder and triggers updated notification', () => {
    const mockStorage = new MockStorage();
    const reference = new Date(2026, 10, 5, 8, 0, 0);

    const taskOriginal = {
      id: 'task-edit',
      title: 'Design Review',
      dueDate: '2026-11-05',
      reminderTime: '09:00',
      status: 'pending',
    };

    const res1 = checkReminders([taskOriginal], {
      referenceDate: reference,
      storage: mockStorage,
      preferences: { inAppAlerts: true, dueSoonHours: 24 },
    });
    assert.equal(res1.newNotifications.length, 1);

    // Second run: same reminder time is deduplicated
    const res2 = checkReminders([taskOriginal], {
      referenceDate: reference,
      storage: mockStorage,
      preferences: { inAppAlerts: true, dueSoonHours: 24 },
    });
    assert.equal(res2.newNotifications.length, 0);

    // User edits reminder time to 14:00
    const taskEdited = {
      ...taskOriginal,
      reminderTime: '14:00',
    };

    // Third run: new reminder key fires
    const res3 = checkReminders([taskEdited], {
      referenceDate: reference,
      storage: mockStorage,
      preferences: { inAppAlerts: true, dueSoonHours: 24 },
    });
    assert.equal(res3.newNotifications.length, 1);
    assert.ok(res3.newNotifications[0].key.includes('14:00'));
  });

  test('reopening a completed task makes it eligible for reminders again', () => {
    const mockStorage = new MockStorage();
    const reference = new Date(2026, 10, 5, 8, 0, 0);

    const task = {
      id: 'task-lifecycle',
      title: 'Sprint Planning',
      dueDate: '2026-11-05',
      reminderTime: '09:00',
      status: 'pending',
      completed: false,
    };

    // 1. Initial reminder fires
    checkReminders([task], {
      referenceDate: reference,
      storage: mockStorage,
      preferences: { inAppAlerts: true, dueSoonHours: 24 },
    });
    let keys = loadNotifiedReminders(mockStorage);
    assert.equal(keys.size, 1);

    // 2. Task is completed and keys are pruned
    const completedTask = { ...task, status: 'completed', completed: true };
    pruneNotifiedReminders([completedTask], null, mockStorage);
    keys = loadNotifiedReminders(mockStorage);
    assert.equal(keys.size, 0, 'Completed task keys must be pruned');

    // 3. Task is reopened
    const reopenedTask = { ...task, status: 'pending', completed: false };
    const resReopened = checkReminders([reopenedTask], {
      referenceDate: reference,
      storage: mockStorage,
      preferences: { inAppAlerts: true, dueSoonHours: 24 },
    });
    assert.equal(resReopened.newNotifications.length, 1, 'Reopened task must be eligible for reminders');
  });
});

describe('Smart Reminders — Daily Productivity Briefing', () => {
  test('generates structured daily briefing and prevents duplicates on the same day', () => {
    const storage = new MockStorage();
    const refDate = new Date(2026, 10, 5, 9, 0, 0);

    const tasks = [
      { id: '1', title: 'Task Due Today', dueDate: '2026-11-05', status: 'pending', priority: 'high' },
      { id: '2', title: 'Overdue Task', dueDate: '2026-11-02', status: 'pending', priority: 'medium' },
      { id: '3', title: 'Future Task', dueDate: '2026-11-10', status: 'pending', priority: 'low' },
    ];

    const briefing1 = generateDailyBriefing(tasks, { referenceDate: refDate, storage });
    assert.ok(briefing1);
    assert.equal(briefing1.type, 'daily_summary');
    assert.equal(briefing1.priority, 'high');
    assert.ok(briefing1.message.includes('1 task due today (1 high priority)'));
    assert.ok(briefing1.message.includes('1 overdue item'));

    // Second call on the same calendar day returns null (deduplicated)
    const briefing2 = generateDailyBriefing(tasks, { referenceDate: refDate, storage });
    assert.equal(briefing2, null);

    // Moving to tomorrow generates a fresh briefing
    const tomorrow = new Date(2026, 10, 6, 9, 0, 0);
    const briefingTomorrow = generateDailyBriefing(tasks, { referenceDate: tomorrow, storage });
    assert.ok(briefingTomorrow);
  });

  test('handles empty task list gracefully with clean zero-state message', () => {
    const storage = new MockStorage();
    const briefing = generateDailyBriefing([], { storage, force: true });
    assert.ok(briefing);
    assert.equal(briefing.type, 'daily_summary');
    assert.equal(briefing.priority, 'low');
    assert.ok(briefing.message.includes('All clear!'));
  });

  test('suppresses daily briefing before 09:00 scheduled morning hour unless forced', () => {
    const storage = new MockStorage();
    const earlyMorning = new Date(2026, 10, 5, 6, 30, 0); // 06:30 AM
    const midnight = new Date(2026, 10, 5, 0, 5, 0); // 00:05 AM

    assert.equal(generateDailyBriefing([], { referenceDate: earlyMorning, storage }), null);
    assert.equal(generateDailyBriefing([], { referenceDate: midnight, storage }), null);

    // After 09:00 (e.g. 09:00, 10:30), briefing generates successfully
    const morning9am = new Date(2026, 10, 5, 9, 0, 0);
    const briefingAt9 = generateDailyBriefing([], { referenceDate: morning9am, storage });
    assert.ok(briefingAt9);
    assert.equal(briefingAt9.type, 'daily_summary');
  });

  test('force flag allows generating daily briefing before 09:00 threshold', () => {
    const storage = new MockStorage();
    const earlyMorning = new Date(2026, 10, 5, 7, 0, 0);
    const briefing = generateDailyBriefing([], { referenceDate: earlyMorning, storage, force: true });
    assert.ok(briefing);
  });
});

describe('Smart Reminders — Overdue Notification Batching', () => {
  test('1 or 2 overdue tasks trigger individual notifications', () => {
    const storage = new MockStorage();
    const refDate = new Date(2026, 10, 5, 12, 0, 0);

    const tasks = [
      { id: 'o1', title: 'Overdue 1', dueDate: '2026-11-02', status: 'pending', priority: 'medium' },
      { id: 'o2', title: 'Overdue 2', dueDate: '2026-11-03', status: 'pending', priority: 'low' },
    ];

    const res = checkReminders(tasks, {
      referenceDate: refDate,
      storage,
      preferences: { inAppAlerts: true },
    });

    assert.equal(res.newNotifications.length, 2);
    assert.equal(res.newNotifications[0].taskId, 'o1');
    assert.equal(res.newNotifications[1].taskId, 'o2');
  });

  test('3 or more overdue tasks batch into summary while preserving high-priority visibility', () => {
    const storage = new MockStorage();
    const refDate = new Date(2026, 10, 5, 12, 0, 0);

    const tasks = [
      { id: 'o1', title: 'General Overdue 1', dueDate: '2026-11-01', status: 'pending', priority: 'low' },
      { id: 'o2', title: 'General Overdue 2', dueDate: '2026-11-02', status: 'pending', priority: 'medium' },
      { id: 'o3', title: 'High Priority Overdue', dueDate: '2026-11-03', status: 'pending', priority: 'high' },
    ];

    const res = checkReminders(tasks, {
      referenceDate: refDate,
      storage,
      preferences: { inAppAlerts: true },
    });

    // 2 notifications: 1 individual alert for the High priority task + 1 batched summary for the rest
    assert.equal(res.newNotifications.length, 2);

    const highAlert = res.newNotifications.find(n => n.taskId === 'o3');
    assert.ok(highAlert);
    assert.equal(highAlert.priority, 'high');
    assert.ok(highAlert.message.includes('High Priority'));

    const batchAlert = res.newNotifications.find(n => n.taskId === null);
    assert.ok(batchAlert);
    assert.ok(batchAlert.message.includes('3 tasks are overdue (1 high priority)'));

    // Second run with the same tasks does NOT duplicate
    const res2 = checkReminders(tasks, {
      referenceDate: refDate,
      storage,
      preferences: { inAppAlerts: true },
    });
    assert.equal(res2.newNotifications.length, 0);
  });
});

describe('Smart Reminders — Scheduler Lifecycle & Visibility Reconciliation', () => {
  beforeEach(() => {
    stopReminderScheduler();
  });

  test('startReminderScheduler starts timer and prevents duplicate initialization', () => {
    let checkCount = 0;
    const dummyCheck = () => { checkCount++; };

    assert.equal(isSchedulerRunning(), false);
    const started1 = startReminderScheduler(dummyCheck, { intervalMs: 100000 });
    assert.equal(started1, true);
    assert.equal(isSchedulerRunning(), true);
    assert.equal(checkCount, 1, 'Initial immediate check must execute');

    // Attempting to start again returns false and does not run immediate check again
    const started2 = startReminderScheduler(dummyCheck, { intervalMs: 100000 });
    assert.equal(started2, false);
    assert.equal(checkCount, 1);

    // Clean teardown
    const stopped = stopReminderScheduler();
    assert.equal(stopped, true);
    assert.equal(isSchedulerRunning(), false);
  });

  test('visibility change reconciles reminders with 30s throttling', () => {
    let checkCount = 0;
    const dummyCheck = () => { checkCount++; };

    const mockDoc = {
      hidden: true,
      listeners: new Map(),
      addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(handler);
      },
      removeEventListener(type, handler) {
        if (this.listeners.has(type)) {
          const list = this.listeners.get(type);
          const idx = list.indexOf(handler);
          if (idx !== -1) list.splice(idx, 1);
        }
      },
      dispatch(type) {
        for (const h of this.listeners.get(type) || []) h();
      },
    };

    startReminderScheduler(dummyCheck, {
      intervalMs: 100000,
      throttleMs: 30000,
      targetDoc: mockDoc,
    });
    assert.equal(checkCount, 1); // Initial check

    // Visibility change while hidden: no check
    mockDoc.hidden = true;
    mockDoc.dispatch('visibilitychange');
    assert.equal(checkCount, 1);

    // Tab becomes visible: immediate check
    mockDoc.hidden = false;
    mockDoc.dispatch('visibilitychange');
    assert.equal(checkCount, 2);

    // Rapid second visibility change within 30s: throttled, checkCount remains 2
    mockDoc.dispatch('visibilitychange');
    assert.equal(checkCount, 2);

    stopReminderScheduler(mockDoc);
  });

  test('stopReminderScheduler stops running timer and cleans up visibility listener', () => {
    let checkCalled = false;
    const dummyCheck = () => { checkCalled = true; };
    let removedListener = false;
    const mockDoc = {
      hidden: false,
      addEventListener: () => {},
      removeEventListener: (type) => {
        if (type === 'visibilitychange') removedListener = true;
      },
    };

    startReminderScheduler(dummyCheck, { intervalMs: 50000, targetDoc: mockDoc });
    assert.equal(isSchedulerRunning(), true);

    const stopped = stopReminderScheduler(mockDoc);
    assert.equal(stopped, true);
    assert.equal(isSchedulerRunning(), false);
    assert.equal(removedListener, true);
  });

  test('back-forward cache recovery safely restarts stopped scheduler without duplicate timers', () => {
    let checkCount = 0;
    const dummyCheck = () => { checkCount++; };

    // 1. Initial page load starts scheduler
    assert.equal(isSchedulerRunning(), false);
    startReminderScheduler(dummyCheck, { intervalMs: 60000 });
    assert.equal(isSchedulerRunning(), true);
    assert.equal(checkCount, 1);

    // 2. Navigation teardown (pagehide / beforeunload) stops scheduler
    stopReminderScheduler();
    assert.equal(isSchedulerRunning(), false);

    // 3. Page restored from back-forward cache (simulating pageshow with persisted: true)
    const restarted = startReminderScheduler(dummyCheck, { intervalMs: 60000 });
    assert.equal(restarted, true);
    assert.equal(isSchedulerRunning(), true);
    assert.equal(checkCount, 2);

    // 4. Repeated recovery calls do not spawn multiple timer loops
    const redundantStart = startReminderScheduler(dummyCheck, { intervalMs: 60000 });
    assert.equal(redundantStart, false);
    assert.equal(checkCount, 2);

    stopReminderScheduler();
    assert.equal(isSchedulerRunning(), false);
  });
});

