/**
 * TaskFlow — reminders.js
 * Smart Reminders engine: browser notification permission flow, in-app alerts,
 * due-soon indicators, overdue tracking, and deduplicated notification delivery.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { parseLocalDate } from './utils.js';

export const STORAGE_KEY_REMINDER_PREFS = 'taskflow_reminder_prefs';
export const STORAGE_KEY_NOTIFIED_REMINDERS = 'taskflow_notified_reminders';

export const DEFAULT_REMINDER_PREFERENCES = Object.freeze({
  browserNotifications: false,
  inAppAlerts: true,
  dueSoonHours: 24,
});

/**
 * Check if the browser Notifications API is available.
 *
 * @returns {boolean}
 */
export function isNotificationSupported() {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
}

/**
 * Get current browser notification permission state.
 *
 * @returns {'granted'|'denied'|'default'|'unsupported'}
 */
export function getNotificationPermission() {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

/**
 * Request notification permission from the user.
 * Must only be invoked from an explicit user interaction (e.g., settings toggle or button click).
 *
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch (_) {
    return 'denied';
  }
}

/**
 * Load reminder preferences from storage.
 *
 * @param {Storage|null} [storage]
 * @returns {typeof DEFAULT_REMINDER_PREFERENCES}
 */
export function loadReminderPreferences(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return { ...DEFAULT_REMINDER_PREFERENCES };

  try {
    const raw = storage.getItem(STORAGE_KEY_REMINDER_PREFS);
    if (!raw) return { ...DEFAULT_REMINDER_PREFERENCES };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_REMINDER_PREFERENCES };

    return {
      browserNotifications: Boolean(parsed.browserNotifications),
      inAppAlerts: parsed.inAppAlerts !== undefined ? Boolean(parsed.inAppAlerts) : true,
      dueSoonHours: typeof parsed.dueSoonHours === 'number' && parsed.dueSoonHours > 0 ? parsed.dueSoonHours : 24,
    };
  } catch (_) {
    return { ...DEFAULT_REMINDER_PREFERENCES };
  }
}

/**
 * Save reminder preferences to storage.
 *
 * @param {object} prefs
 * @param {Storage|null} [storage]
 * @returns {boolean}
 */
export function saveReminderPreferences(prefs, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return false;
  try {
    const safePrefs = {
      browserNotifications: Boolean(prefs.browserNotifications),
      inAppAlerts: prefs.inAppAlerts !== undefined ? Boolean(prefs.inAppAlerts) : true,
      dueSoonHours: typeof prefs.dueSoonHours === 'number' && prefs.dueSoonHours > 0 ? prefs.dueSoonHours : 24,
    };
    storage.setItem(STORAGE_KEY_REMINDER_PREFS, JSON.stringify(safePrefs));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Load set of composite reminder keys that have already been fired.
 *
 * @param {Storage|null} [storage]
 * @returns {Set<string>}
 */
export function loadNotifiedReminders(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(STORAGE_KEY_NOTIFIED_REMINDERS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter(k => typeof k === 'string'));
    }
    return new Set();
  } catch (_) {
    return new Set();
  }
}

/**
 * Save notified reminder keys to storage.
 *
 * @param {Set<string>|Array<string>} keys
 * @param {Storage|null} [storage]
 * @returns {boolean}
 */
export function saveNotifiedReminders(keys, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return false;
  try {
    const arr = Array.from(keys);
    // Keep size bounded to avoid localStorage buildup
    const bounded = arr.slice(-500);
    storage.setItem(STORAGE_KEY_NOTIFIED_REMINDERS, JSON.stringify(bounded));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Clear the record of fired notifications.
 *
 * @param {Storage|null} [storage]
 * @returns {boolean}
 */
export function clearNotifiedReminders(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY_NOTIFIED_REMINDERS);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Parse a task's full due Date object, taking optional reminderTime into account.
 *
 * @param {object} task
 * @returns {Date|null}
 */
export function getTaskDueDateTime(task) {
  if (!task || !task.dueDate) return null;
  const baseDate = parseLocalDate(task.dueDate);
  if (!baseDate) return null;

  let hours = 9;
  let minutes = 0;

  if (typeof task.reminderTime === 'string') {
    const match = /^(\d{1,2}):(\d{2})$/.exec(task.reminderTime.trim());
    if (match) {
      hours = Math.min(23, Math.max(0, parseInt(match[1], 10)));
      minutes = Math.min(59, Math.max(0, parseInt(match[2], 10)));
    }
  }

  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes,
    0,
    0
  );
}

/**
 * Check whether a pending task is due soon (within thresholdHours).
 *
 * @param {object} task
 * @param {Date} [referenceDate]
 * @param {number} [thresholdHours=24]
 * @returns {boolean}
 */
export function isDueSoon(task, referenceDate = new Date(), thresholdHours = 24) {
  if (!task || task.completed || task.status === 'completed' || !task.dueDate) {
    return false;
  }
  const dueDateTime = getTaskDueDateTime(task);
  if (!dueDateTime) return false;

  const diffMs = dueDateTime.getTime() - referenceDate.getTime();
  const thresholdMs = thresholdHours * 60 * 60 * 1000;

  // Due soon means in the future, but within the threshold window
  return diffMs >= 0 && diffMs <= thresholdMs;
}

/**
 * Check whether a pending task is overdue at the given reference date.
 *
 * @param {object} task
 * @param {Date} [referenceDate]
 * @returns {boolean}
 */
export function isOverdueReminder(task, referenceDate = new Date()) {
  if (!task || task.completed || task.status === 'completed' || !task.dueDate) {
    return false;
  }
  const dueDateTime = getTaskDueDateTime(task);
  if (!dueDateTime) return false;

  return dueDateTime.getTime() < referenceDate.getTime();
}

/**
 * Construct a deterministic unique reminder key to prevent duplicate notifications.
 *
 * @param {string} taskId
 * @param {string} dueDate
 * @param {'due_soon'|'overdue'} type
 * @returns {string}
 */
export function buildReminderKey(taskId, dueDate, type) {
  return `${taskId}:${dueDate || 'none'}:${type}`;
}

/**
 * Evaluate tasks and dispatch due-soon and overdue reminders.
 *
 * @param {Array<object>} tasks
 * @param {object} [options]
 * @param {Date} [options.referenceDate]
 * @param {object} [options.preferences]
 * @param {Set<string>} [options.notifiedKeys]
 * @param {Function} [options.onInAppNotify]
 * @param {Function} [options.onBrowserNotify]
 * @param {Storage} [options.storage]
 * @returns {{ dueSoonTasks: Array<object>, overdueTasks: Array<object>, newNotifications: Array<object> }}
 */
export function checkReminders(tasks, options = {}) {
  const referenceDate = options.referenceDate || new Date();
  const storage = options.storage !== undefined ? options.storage : (typeof window !== 'undefined' ? window.localStorage : null);
  const prefs = options.preferences || loadReminderPreferences(storage);
  const notifiedKeys = options.notifiedKeys || loadNotifiedReminders(storage);

  const dueSoonTasks = [];
  const overdueTasks = [];
  const newNotifications = [];

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { dueSoonTasks, overdueTasks, newNotifications };
  }

  for (const task of tasks) {
    if (!task || task.completed || task.status === 'completed' || !task.dueDate) {
      continue;
    }

    if (isDueSoon(task, referenceDate, prefs.dueSoonHours)) {
      dueSoonTasks.push(task);
      const key = buildReminderKey(task.id, task.dueDate, 'due_soon');
      if (!notifiedKeys.has(key)) {
        notifiedKeys.add(key);
        newNotifications.push({
          key,
          taskId: task.id,
          taskTitle: task.title,
          type: 'due_soon',
          dueDate: task.dueDate,
          message: `Task "${task.title}" is due soon (${task.dueDate})`,
        });
      }
    } else if (isOverdueReminder(task, referenceDate)) {
      overdueTasks.push(task);
      const key = buildReminderKey(task.id, task.dueDate, 'overdue');
      if (!notifiedKeys.has(key)) {
        notifiedKeys.add(key);
        newNotifications.push({
          key,
          taskId: task.id,
          taskTitle: task.title,
          type: 'overdue',
          dueDate: task.dueDate,
          message: `Task "${task.title}" is overdue! (Due: ${task.dueDate})`,
        });
      }
    }
  }

  // Persist updated keys
  if (newNotifications.length > 0 && storage) {
    saveNotifiedReminders(notifiedKeys, storage);
  }

  // Dispatch callbacks
  for (const notification of newNotifications) {
    if (prefs.inAppAlerts && typeof options.onInAppNotify === 'function') {
      try {
        options.onInAppNotify(notification);
      } catch (_) {
        // Safe callback handling
      }
    }

    if (prefs.browserNotifications && typeof options.onBrowserNotify === 'function') {
      try {
        options.onBrowserNotify(notification);
      } catch (_) {
        // Safe callback handling
      }
    }
  }

  return { dueSoonTasks, overdueTasks, newNotifications };
}

