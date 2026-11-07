/**
 * TaskFlow — recurrence.js
 * Deterministic recurring task engine for automated schedule progression,
 * month-end clamps, leap year handling, and duplicate prevention.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { parseLocalDate, nowISO, generateId } from './utils.js';
import { formatCalendarDate, getDaysInMonth } from './calendar.js';

export const RECURRENCE_TYPES = Object.freeze([
  'none',
  'daily',
  'weekdays',
  'weekly',
  'monthly',
  'yearly',
  'custom',
]);

/**
 * Validate and sanitize a recurrence configuration object.
 *
 * @param {Object} rule
 * @returns {{
 *   type: 'none'|'daily'|'weekdays'|'weekly'|'monthly'|'yearly'|'custom',
 *   interval: number,
 *   daysOfWeek: number[]|null,
 *   endDate: string|null,
 *   maxOccurrences: number|null
 * }}
 */
export function validateRecurrenceRule(rule) {
  if (!rule || typeof rule !== 'object') {
    return { type: 'none', interval: 1, daysOfWeek: null, endDate: null, maxOccurrences: null };
  }

  const rawType = String(rule.type || 'none').toLowerCase().trim();
  const type = RECURRENCE_TYPES.includes(rawType) ? rawType : 'none';

  let interval = Number.isInteger(rule.interval) && rule.interval > 0 ? rule.interval : 1;
  if (interval > 365) interval = 365;

  let daysOfWeek = null;
  if (Array.isArray(rule.daysOfWeek)) {
    daysOfWeek = rule.daysOfWeek
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b);
    if (daysOfWeek.length === 0) daysOfWeek = null;
  }

  let endDate = null;
  if (rule.endDate && typeof rule.endDate === 'string') {
    const parsed = parseLocalDate(rule.endDate);
    if (parsed) {
      endDate = formatCalendarDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  let maxOccurrences = null;
  if (Number.isInteger(rule.maxOccurrences) && rule.maxOccurrences > 0) {
    maxOccurrences = rule.maxOccurrences;
  }

  return {
    type,
    interval,
    daysOfWeek,
    endDate,
    maxOccurrences,
  };
}

/**
 * Calculate the next due date based on the current due date and recurrence pattern.
 * If the current due date is already in the past relative to referenceDate,
 * progression advances from referenceDate so overdue tasks do not spawn another past date.
 *
 * @param {string|Date|null} baseDateInput
 * @param {Object} recurrenceRule
 * @param {string|Date|null} [referenceDate=null]
 * @returns {string|null} YYYY-MM-DD or null if recurrence has ended
 */
export function calculateNextDueDate(baseDateInput, recurrenceRule, referenceDate = null) {
  const rule = validateRecurrenceRule(recurrenceRule);
  if (rule.type === 'none') return null;

  const parsedBase = parseLocalDate(baseDateInput);
  const parsedRef = parseLocalDate(referenceDate);

  // If baseDateInput is in the past relative to referenceDate, calculate from referenceDate
  const isOverdue = Boolean(parsedBase && parsedRef && parsedBase.getTime() < parsedRef.getTime());
  const base = isOverdue ? parsedRef : (parsedBase || parsedRef || new Date());

  let next = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  switch (rule.type) {
    case 'daily': {
      next.setDate(next.getDate() + rule.interval);
      break;
    }

    case 'weekdays': {
      // Advance to next Monday–Friday
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6); // 0 = Sun, 6 = Sat
      break;
    }

    case 'weekly': {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        // Advance day by day until matching one of the chosen days
        let found = false;
        for (let step = 1; step <= 7 * rule.interval; step++) {
          const testDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + step);
          if (rule.daysOfWeek.includes(testDate.getDay())) {
            next = testDate;
            found = true;
            break;
          }
        }
        if (!found) {
          next.setDate(next.getDate() + 7 * rule.interval);
        }
      } else if (isOverdue && parsedBase) {
        // Preserve original weekday schedule when advancing overdue weekly tasks
        const targetDay = parsedBase.getDay();
        let daysAhead = (targetDay - base.getDay() + 7) % 7;
        if (daysAhead === 0) {
          daysAhead = 7 * rule.interval;
        }
        next.setDate(next.getDate() + daysAhead);
      } else {
        next.setDate(next.getDate() + 7 * rule.interval);
      }
      break;
    }

    case 'monthly': {
      if (isOverdue && parsedBase) {
        // Find next scheduled monthly due day on or after referenceDate
        const baseTotalMonths = parsedBase.getFullYear() * 12 + parsedBase.getMonth();
        const refTotalMonths = parsedRef.getFullYear() * 12 + parsedRef.getMonth();
        const monthDiff = Math.max(0, refTotalMonths - baseTotalMonths);
        const stepMonths = Math.ceil(monthDiff / rule.interval) * rule.interval;
        let targetTotalMonths = baseTotalMonths + stepMonths;

        const calcMonthlyDate = (totalMonths) => {
          const year = Math.floor(totalMonths / 12);
          const month = ((totalMonths % 12) + 12) % 12;
          const days = getDaysInMonth(year, month);
          const day = Math.min(parsedBase.getDate(), days);
          return new Date(year, month, day);
        };

        let candidate = calcMonthlyDate(targetTotalMonths);
        if (candidate.getTime() <= parsedRef.getTime()) {
          targetTotalMonths += rule.interval;
          candidate = calcMonthlyDate(targetTotalMonths);
        }
        next = candidate;
      } else {
        // Month-end clamp handling: e.g. Jan 31 -> Feb 28 (or 29 in leap year)
        const targetMonthIndex = base.getMonth() + rule.interval;
        const targetYear = base.getFullYear() + Math.floor(targetMonthIndex / 12);
        const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

        const daysInTargetMonth = getDaysInMonth(targetYear, normalizedMonth);
        const targetDay = Math.min(base.getDate(), daysInTargetMonth);

        next = new Date(targetYear, normalizedMonth, targetDay);
      }
      break;
    }

    case 'yearly': {
      if (isOverdue && parsedBase) {
        // Find next scheduled anniversary on or after referenceDate without skipping current year
        const baseYear = parsedBase.getFullYear();
        const refYear = parsedRef.getFullYear();
        const yearDiff = Math.max(0, refYear - baseYear);
        const stepYears = Math.ceil(yearDiff / rule.interval) * rule.interval;
        let targetYear = baseYear + stepYears;
        const targetMonth = parsedBase.getMonth();

        const calcYearlyDate = (year) => {
          const days = getDaysInMonth(year, targetMonth);
          const day = Math.min(parsedBase.getDate(), days);
          return new Date(year, targetMonth, day);
        };

        let candidate = calcYearlyDate(targetYear);
        if (candidate.getTime() <= parsedRef.getTime()) {
          targetYear += rule.interval;
          candidate = calcYearlyDate(targetYear);
        }
        next = candidate;
      } else {
        // Standard future progression with leap-year clamping: e.g. Feb 29 2024 -> Feb 28 2025
        const targetYear = base.getFullYear() + rule.interval;
        const month = base.getMonth();
        const daysInTargetMonth = getDaysInMonth(targetYear, month);
        const targetDay = Math.min(base.getDate(), daysInTargetMonth);

        next = new Date(targetYear, month, targetDay);
      }
      break;
    }

    case 'custom': {
      next.setDate(next.getDate() + rule.interval);
      break;
    }

    default:
      return null;
  }

  const nextStr = formatCalendarDate(next.getFullYear(), next.getMonth(), next.getDate());

  // Check end date cutoff
  if (rule.endDate) {
    const end = parseLocalDate(rule.endDate);
    if (end && next.getTime() > end.getTime()) {
      return null;
    }
  }

  return nextStr;
}

/**
 * Complete a recurring task:
 * 1. Returns a completed copy of the existing task.
 * 2. If recurrence is enabled and not expired, generates the next pending occurrence.
 *
 * @param {import('./tasks.js').Task} task
 * @param {Date} [referenceDate]
 * @returns {{ completedTask: import('./tasks.js').Task, nextTask: import('./tasks.js').Task|null }}
 */
export function completeRecurringTask(task, referenceDate = new Date()) {
  const ref = parseLocalDate(referenceDate)
    || (referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date());

  const now = nowISO();
  const completedTask = {
    ...task,
    status: 'completed',
    completed: true,
    updatedAt: now,
  };

  const rule = validateRecurrenceRule(task.recurrence);
  if (rule.type === 'none') {
    return { completedTask, nextTask: null };
  }

  const baseDate = task.dueDate || ref;
  const nextDueDate = calculateNextDueDate(baseDate, rule, ref);
  if (!nextDueDate) {
    return { completedTask, nextTask: null };
  }

  const subtasks = Array.isArray(task.subtasks)
    ? task.subtasks.map(s => ({ ...s, id: generateId(), completed: false }))
    : [];

  const nextTask = {
    ...task,
    id: generateId(),
    status: 'pending',
    completed: false,
    dueDate: nextDueDate,
    subtasks,
    recurringParentId: task.recurringParentId || task.id,
    createdAt: now,
    updatedAt: now,
  };

  return { completedTask, nextTask };
}

/**
 * Stop recurrence on a task (disables future occurrence generation).
 *
 * @param {import('./tasks.js').Task} task
 * @returns {import('./tasks.js').Task}
 */
export function stopTaskRecurrence(task) {
  return {
    ...task,
    recurrence: { type: 'none', interval: 1, daysOfWeek: null, endDate: null, maxOccurrences: null },
    updatedAt: nowISO(),
  };
}

/**
 * Format a recurrence rule into a friendly human-readable label.
 *
 * @param {Object} rule
 * @returns {string}
 */
export function formatRecurrenceLabel(rule) {
  const r = validateRecurrenceRule(rule);
  switch (r.type) {
    case 'daily':
      return r.interval === 1 ? 'Every day' : `Every ${r.interval} days`;
    case 'weekdays':
      return 'Every weekday (Mon–Fri)';
    case 'weekly':
      return r.interval === 1 ? 'Every week' : `Every ${r.interval} weeks`;
    case 'monthly':
      return r.interval === 1 ? 'Every month' : `Every ${r.interval} months`;
    case 'yearly':
      return r.interval === 1 ? 'Every year' : `Every ${r.interval} years`;
    case 'custom':
      return `Every ${r.interval} days`;
    case 'none':
    default:
      return 'Does not repeat';
  }
}

