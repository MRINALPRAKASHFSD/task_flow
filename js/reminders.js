/**
 * TaskFlow — reminders.js
 * Smart Reminders engine: browser notification permission flow, in-app alerts,
 * due-soon indicators, overdue tracking, and deduplicated notification delivery.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import {
  parseLocalDate,
  isDateToday,
  isDateOverdue,
} from './utils.js';

export const STORAGE_KEY_REMINDER_PREFS = 'taskflow_reminder_prefs';
export const STORAGE_KEY_NOTIFIED_REMINDERS = 'taskflow_notified_reminders';
export const STORAGE_KEY_DAILY_BRIEFING = 'taskflow_daily_briefing';

export const PRIORITY_THRESHOLDS = Object.freeze({
  ALL: 'all',
  MEDIUM_HIGH: 'medium_high',
  HIGH_ONLY: 'high_only',
});

export const DEFAULT_REMINDER_PREFERENCES = Object.freeze({
  browserNotifications: false,
  inAppAlerts: true,
  dueSoonHours: 24,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  priorityFilter: 'all',
  dailyBriefingEnabled: true,
});

export const REMINDER_CHECK_INTERVAL_MS = 60000;
export const VISIBILITY_THROTTLE_MS = 30000;
export const OVERDUE_BATCH_THRESHOLD = 3;

// Active scheduler tracking
let activeSchedulerTimerId = null;
let lastVisibilityCheckTime = 0;
let visibilityHandlerRef = null;

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
 * Normalize and validate a time string into 24-hour HH:MM format.
 *
 * @param {string} timeStr
 * @param {string} [defaultVal='00:00']
 * @returns {string} Valid HH:MM string
 */
export function normalizeTimeString(timeStr, defaultVal = '00:00') {
  if (typeof timeStr !== 'string') return defaultVal;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return defaultVal;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return defaultVal;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Normalize and bound due soon hours into a finite integer within [1, 168].
 *
 * @param {any} val
 * @param {number} [defaultVal=24]
 * @returns {number} Bounded due soon hours
 */
export function normalizeDueSoonHours(val, defaultVal = 24) {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return defaultVal;
  return Math.max(1, Math.min(168, Math.round(num)));
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
      dueSoonHours: normalizeDueSoonHours(parsed.dueSoonHours, 24),
      quietHoursEnabled: Boolean(parsed.quietHoursEnabled),
      quietHoursStart: normalizeTimeString(parsed.quietHoursStart, '22:00'),
      quietHoursEnd: normalizeTimeString(parsed.quietHoursEnd, '08:00'),
      priorityFilter: ['all', 'medium_high', 'high_only'].includes(parsed.priorityFilter)
        ? parsed.priorityFilter
        : 'all',
      dailyBriefingEnabled: parsed.dailyBriefingEnabled !== undefined ? Boolean(parsed.dailyBriefingEnabled) : true,
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
  if (!storage || !prefs || typeof prefs !== 'object') return false;
  try {
    const safePrefs = {
      browserNotifications: Boolean(prefs.browserNotifications),
      inAppAlerts: prefs.inAppAlerts !== undefined ? Boolean(prefs.inAppAlerts) : true,
      dueSoonHours: normalizeDueSoonHours(prefs.dueSoonHours, 24),
      quietHoursEnabled: Boolean(prefs.quietHoursEnabled),
      quietHoursStart: normalizeTimeString(prefs.quietHoursStart, '22:00'),
      quietHoursEnd: normalizeTimeString(prefs.quietHoursEnd, '08:00'),
      priorityFilter: ['all', 'medium_high', 'high_only'].includes(prefs.priorityFilter)
        ? prefs.priorityFilter
        : 'all',
      dailyBriefingEnabled: prefs.dailyBriefingEnabled !== undefined ? Boolean(prefs.dailyBriefingEnabled) : true,
    };
    storage.setItem(STORAGE_KEY_REMINDER_PREFS, JSON.stringify(safePrefs));
    if (!Object.isFrozen(prefs)) {
      Object.assign(prefs, safePrefs);
    }
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
 * Prune notified reminder keys for tasks that are no longer pending or no longer exist.
 * Also cleans up stale batch keys.
 *
 * @param {Array<object>} tasks - Active task array
 * @param {Set<string>|Array<string>|null} [keys=null] - Specific key set or null to read from storage
 * @param {Storage|null} [storage]
 * @returns {Set<string>} Pruned active key set
 */
export function pruneNotifiedReminders(tasks, keys = null, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  const currentKeys = keys instanceof Set
    ? new Set(keys)
    : (Array.isArray(keys) ? new Set(keys) : loadNotifiedReminders(storage));

  if (!Array.isArray(tasks) || tasks.length === 0) {
    if (storage) saveNotifiedReminders(new Set(), storage);
    return new Set();
  }

  const activePendingIds = new Set(
    tasks
      .filter(t => t && !t.completed && t.status !== 'completed' && t.dueDate)
      .map(t => t.id)
  );

  const pruned = new Set();
  for (const key of currentKeys) {
    if (typeof key !== 'string') continue;
    if (key.startsWith('overdue_batch:')) {
      const batchIds = key.replace('overdue_batch:', '').split(',').filter(Boolean);
      if (batchIds.some(id => activePendingIds.has(id))) {
        pruned.add(key);
      }
    } else {
      const taskId = key.split(':')[0];
      if (activePendingIds.has(taskId)) {
        pruned.add(key);
      }
    }
  }

  if (storage) {
    saveNotifiedReminders(pruned, storage);
  }
  return pruned;
}

/**
 * Parse a "HH:MM" 24-hour time string into minutes since midnight [0, 1439].
 *
 * @param {string} timeStr
 * @returns {number|null}
 */
export function parseTimeToMinutes(timeStr) {
  if (typeof timeStr !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Check whether a reference local time falls within configured quiet hours.
 * Supports overnight spans (e.g. 22:00 to 08:00) and same-day spans (e.g. 13:00 to 14:00).
 * If start === end, quiet hours interval has 0 length and returns false.
 *
 * @param {Date} [referenceDate=new Date()]
 * @param {object} [preferences]
 * @returns {boolean}
 */
export function isQuietHours(referenceDate = new Date(), preferences = DEFAULT_REMINDER_PREFERENCES) {
  if (!preferences || !preferences.quietHoursEnabled) {
    return false;
  }

  const startMin = parseTimeToMinutes(preferences.quietHoursStart);
  const endMin = parseTimeToMinutes(preferences.quietHoursEnd);

  if (startMin === null || endMin === null || startMin === endMin) {
    return false;
  }

  const currentMin = referenceDate.getHours() * 60 + referenceDate.getMinutes();

  if (startMin < endMin) {
    // Same-day span (e.g. 13:00 to 14:00)
    return currentMin >= startMin && currentMin < endMin;
  } else {
    // Overnight span (e.g. 22:00 to 08:00)
    return currentMin >= startMin || currentMin < endMin;
  }
}

/**
 * Determine whether a task's priority meets the configured reminder threshold.
 *
 * @param {string} [taskPriority='medium']
 * @param {'all'|'medium_high'|'high_only'|string} [filter='all']
 * @returns {boolean}
 */
export function isPriorityEligible(taskPriority = 'medium', filter = 'all') {
  const normPrio = typeof taskPriority === 'string' ? taskPriority.toLowerCase().trim() : 'medium';
  const normFilter = typeof filter === 'string' ? filter.toLowerCase().trim() : 'all';

  if (normFilter === 'high_only') {
    return normPrio === 'high';
  }
  if (normFilter === 'medium_high') {
    return normPrio === 'high' || normPrio === 'medium';
  }
  return true;
}

/**
 * Construct a deterministic composite key for a batch of overdue task IDs.
 *
 * @param {Array<string>} taskIds
 * @returns {string}
 */
export function buildOverdueBatchKey(taskIds) {
  const sorted = Array.isArray(taskIds) ? [...taskIds].sort().join(',') : '';
  return `overdue_batch:${sorted}`;
}

/**
 * Generate a structured daily productivity briefing notification.
 * At most one briefing is generated per local calendar day.
 * Respects morning delivery threshold (09:00 local time).
 *
 * @param {Array<object>} tasks - Active task array
 * @param {object} [options]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {Storage|null} [options.storage]
 * @param {boolean} [options.force=false]
 * @param {number} [options.earliestHour=9]
 * @returns {object|null} Briefing notification record or null if already generated today or before 09:00
 */
export function generateDailyBriefing(tasks = [], options = {}) {
  const referenceDate = options.referenceDate || new Date();
  const storage = options.storage !== undefined
    ? options.storage
    : (typeof window !== 'undefined' ? window.localStorage : null);
  const force = Boolean(options.force);
  const earliestHour = typeof options.earliestHour === 'number' ? options.earliestHour : 9;

  // Respect morning scheduling threshold (09:00 local time)
  if (!force && referenceDate.getHours() < earliestHour) {
    return null;
  }

  const y = referenceDate.getFullYear();
  const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const d = String(referenceDate.getDate()).padStart(2, '0');
  const todayDateStr = `${y}-${m}-${d}`;

  // Check if briefing was already issued for today
  if (!force && storage) {
    try {
      const lastDate = storage.getItem(STORAGE_KEY_DAILY_BRIEFING);
      if (lastDate === todayDateStr) {
        return null;
      }
    } catch (_) {}
  }

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const pendingTasks = safeTasks.filter(t => t && !t.completed && t.status !== 'completed');

  const dueTodayTasks = [];
  const overdueTasks = [];
  const highPriorityDue = [];

  for (const t of pendingTasks) {
    if (!t.dueDate) continue;
    if (isDateToday(t.dueDate, referenceDate)) {
      dueTodayTasks.push(t);
      if (t.priority === 'high') {
        highPriorityDue.push(t);
      }
    } else if (isDateOverdue(t.dueDate, referenceDate)) {
      overdueTasks.push(t);
    }
  }

  let message = '';
  let priority = 'medium';

  if (safeTasks.length === 0 || pendingTasks.length === 0) {
    message = 'All clear! You have no pending tasks scheduled for today.';
    priority = 'low';
  } else if (dueTodayTasks.length === 0 && overdueTasks.length === 0) {
    message = `You have ${pendingTasks.length} pending task${pendingTasks.length === 1 ? '' : 's'} on your horizon. Nothing is due today.`;
    priority = 'low';
  } else {
    const parts = [];
    if (dueTodayTasks.length > 0) {
      parts.push(`${dueTodayTasks.length} task${dueTodayTasks.length === 1 ? '' : 's'} due today${highPriorityDue.length > 0 ? ` (${highPriorityDue.length} high priority)` : ''}`);
    }
    if (overdueTasks.length > 0) {
      parts.push(`${overdueTasks.length} overdue item${overdueTasks.length === 1 ? '' : 's'}`);
    }
    message = `Today's Briefing: ${parts.join(', ')}.`;
    if (overdueTasks.length > 0 || highPriorityDue.length > 0) {
      priority = 'high';
    }
  }

  const briefingNotification = {
    type: 'daily_summary',
    title: 'Daily Productivity Briefing',
    message,
    priority,
    taskId: null,
    timestamp: referenceDate.toISOString(),
    read: false,
  };

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY_DAILY_BRIEFING, todayDateStr);
    } catch (_) {}
  }

  return briefingNotification;
}

/**
 * Check if the reminder scheduler is currently active.
 *
 * @returns {boolean}
 */
export function isSchedulerRunning() {
  return activeSchedulerTimerId !== null;
}

/**
 * Start the smart reminders scheduler with visibility reconciliation and interval management.
 * Prevents duplicate scheduler initialization.
 *
 * @param {Function} checkCallback - Function to execute on reminder check
 * @param {object} [options]
 * @param {number} [options.intervalMs=60000]
 * @param {number} [options.throttleMs=30000]
 * @param {Document|object} [options.targetDoc]
 * @returns {boolean} Whether scheduler was started (false if already running)
 */
export function startReminderScheduler(checkCallback, options = {}) {
  if (typeof checkCallback !== 'function') return false;
  if (activeSchedulerTimerId !== null) {
    return false;
  }

  const intervalMs = options.intervalMs || REMINDER_CHECK_INTERVAL_MS;
  const throttleMs = options.throttleMs || VISIBILITY_THROTTLE_MS;
  const targetDoc = options.targetDoc !== undefined
    ? options.targetDoc
    : (typeof document !== 'undefined' ? document : null);

  // Initial immediate check
  try {
    checkCallback();
  } catch (_) {}

  // Periodic interval timer
  activeSchedulerTimerId = setInterval(() => {
    try {
      checkCallback();
    } catch (_) {}
  }, intervalMs);

  // Visibility change reconciliation
  if (targetDoc && typeof targetDoc.addEventListener === 'function') {
    visibilityHandlerRef = () => {
      if (targetDoc.hidden) return;
      const now = Date.now();
      if (now - lastVisibilityCheckTime >= throttleMs) {
        lastVisibilityCheckTime = now;
        try {
          checkCallback();
        } catch (_) {}
      }
    };
    targetDoc.addEventListener('visibilitychange', visibilityHandlerRef);
  }

  return true;
}

/**
 * Stop and clean up the active reminder scheduler and its event listeners.
 *
 * @param {Document|object} [targetDoc]
 * @returns {boolean} Whether an active scheduler was stopped
 */
export function stopReminderScheduler(targetDoc = (typeof document !== 'undefined' ? document : null)) {
  let stopped = false;
  if (activeSchedulerTimerId !== null) {
    clearInterval(activeSchedulerTimerId);
    activeSchedulerTimerId = null;
    stopped = true;
  }

  if (targetDoc && typeof targetDoc.removeEventListener === 'function' && visibilityHandlerRef) {
    targetDoc.removeEventListener('visibilitychange', visibilityHandlerRef);
    visibilityHandlerRef = null;
  }

  lastVisibilityCheckTime = 0;
  return stopped;
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
 * Optionally includes reminderTime to allow re-notifying if reminder time is modified.
 *
 * @param {string} taskId
 * @param {string} dueDate
 * @param {'due_soon'|'overdue'|string} type
 * @param {string|null} [reminderTime=null]
 * @returns {string}
 */
export function buildReminderKey(taskId, dueDate, type, reminderTime = null) {
  const timePart = (typeof reminderTime === 'string' && reminderTime.trim()) ? `:${reminderTime.trim()}` : '';
  return `${taskId}:${dueDate || 'none'}${timePart}:${type}`;
}

/**
 * Evaluate tasks and dispatch due-soon, overdue, and batched reminders.
 * Supports quiet hours suppression and priority filtering.
 *
 * @param {Array<object>} tasks
 * @param {object} [options]
 * @param {Date} [options.referenceDate]
 * @param {object} [options.preferences]
 * @param {Set<string>} [options.notifiedKeys]
 * @param {object|null} [options.notificationCenter]
 * @param {number} [options.batchOverdueThreshold]
 * @param {Function} [options.onInAppNotify]
 * @param {Function} [options.onBrowserNotify]
 * @param {Storage} [options.storage]
 * @returns {{ dueSoonTasks: Array<object>, overdueTasks: Array<object>, newNotifications: Array<object>, inQuietHours: boolean }}
 */
export function checkReminders(tasks, options = {}) {
  const referenceDate = options.referenceDate || new Date();
  const storage = options.storage !== undefined
    ? options.storage
    : (typeof window !== 'undefined' ? window.localStorage : null);
  const prefs = options.preferences || loadReminderPreferences(storage);
  const notifiedKeys = options.notifiedKeys || loadNotifiedReminders(storage);
  const notificationCenter = options.notificationCenter || null;
  const batchThreshold = typeof options.batchOverdueThreshold === 'number'
    ? options.batchOverdueThreshold
    : OVERDUE_BATCH_THRESHOLD;

  const inQuietHours = isQuietHours(referenceDate, prefs);

  const dueSoonTasks = [];
  const overdueTasks = [];
  const newNotifications = [];

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { dueSoonTasks, overdueTasks, newNotifications, inQuietHours };
  }

  const unnotifiedOverdue = [];

  for (const task of tasks) {
    if (!task || task.completed || task.status === 'completed' || !task.dueDate) {
      continue;
    }

    // Apply priority filtering
    if (!isPriorityEligible(task.priority, prefs.priorityFilter)) {
      continue;
    }

    if (isDueSoon(task, referenceDate, prefs.dueSoonHours)) {
      dueSoonTasks.push(task);
      const key = buildReminderKey(task.id, task.dueDate, 'due_soon', task.reminderTime);
      if (!notifiedKeys.has(key)) {
        notifiedKeys.add(key);
        newNotifications.push({
          key,
          taskId: task.id,
          taskTitle: task.title,
          type: 'due_soon',
          dueDate: task.dueDate,
          priority: task.priority || 'medium',
          title: 'Task Due Soon',
          message: `Task "${task.title}" is due soon (${task.dueDate})`,
        });
      }
    } else if (isOverdueReminder(task, referenceDate)) {
      overdueTasks.push(task);
      const key = buildReminderKey(task.id, task.dueDate, 'overdue', task.reminderTime);
      if (!notifiedKeys.has(key)) {
        unnotifiedOverdue.push({ task, key });
      }
    }
  }

  // Handle overdue notifications: batching when unnotified count >= batchThreshold
  if (unnotifiedOverdue.length >= batchThreshold) {
    const batchKey = buildOverdueBatchKey(unnotifiedOverdue.map(item => item.task.id));
    if (!notifiedKeys.has(batchKey)) {
      notifiedKeys.add(batchKey);

      // Preserve individual alert for High-priority overdue tasks
      const highPriorityOverdue = unnotifiedOverdue.filter(item => item.task.priority === 'high');
      for (const item of highPriorityOverdue) {
        notifiedKeys.add(item.key);
        newNotifications.push({
          key: item.key,
          taskId: item.task.id,
          taskTitle: item.task.title,
          type: 'overdue',
          dueDate: item.task.dueDate,
          priority: 'high',
          title: 'High Priority Overdue',
          message: `High Priority: "${item.task.title}" is overdue! (Due: ${item.task.dueDate})`,
        });
      }

      // Group the remaining non-high overdue tasks into a batched summary
      const remainingOverdue = unnotifiedOverdue.filter(item => item.task.priority !== 'high');
      if (remainingOverdue.length > 0) {
        for (const item of remainingOverdue) {
          notifiedKeys.add(item.key);
        }
        newNotifications.push({
          key: batchKey,
          taskId: null,
          taskTitle: 'Multiple Tasks Overdue',
          type: 'overdue',
          dueDate: null,
          priority: 'high',
          title: 'Overdue Tasks Summary',
          message: `${unnotifiedOverdue.length} tasks are overdue (${highPriorityOverdue.length} high priority). Please review your schedule.`,
        });
      }
    }
  } else {
    // 1 or 2 overdue tasks: individual alerts
    for (const item of unnotifiedOverdue) {
      notifiedKeys.add(item.key);
      newNotifications.push({
        key: item.key,
        taskId: item.task.id,
        taskTitle: item.task.title,
        type: 'overdue',
        dueDate: item.task.dueDate,
        priority: item.task.priority || 'high',
        title: 'Task Overdue',
        message: `Task "${item.task.title}" is overdue! (Due: ${item.task.dueDate})`,
      });
    }
  }

  // Persist updated keys
  if (newNotifications.length > 0 && storage) {
    saveNotifiedReminders(notifiedKeys, storage);
  }

  // Persist to NotificationCenter (regardless of quiet hours, so history is preserved)
  if (notificationCenter && typeof notificationCenter.addNotification === 'function') {
    for (const notification of newNotifications) {
      try {
        notificationCenter.addNotification({
          type: notification.type,
          title: notification.title || (notification.type === 'overdue' ? 'Task Overdue' : 'Task Due Soon'),
          message: notification.message,
          priority: notification.priority || (notification.type === 'overdue' ? 'high' : 'medium'),
          taskId: notification.taskId || null,
          timestamp: referenceDate.toISOString(),
        });
      } catch (_) {}
    }
  }

  // Dispatch callbacks only if NOT in quiet hours
  if (!inQuietHours) {
    for (const notification of newNotifications) {
      if (prefs.inAppAlerts && typeof options.onInAppNotify === 'function') {
        try {
          options.onInAppNotify(notification);
        } catch (_) {}
      }

      if (prefs.browserNotifications && typeof options.onBrowserNotify === 'function') {
        try {
          options.onBrowserNotify(notification);
        } catch (_) {}
      }
    }
  }

  return { dueSoonTasks, overdueTasks, newNotifications, inQuietHours };
}

