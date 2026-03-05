/**
 * TaskFlow — calendar.js
 * Calendar computation engine: month grid, week overview, day breakdown, and date-task mapping.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { parseLocalDate, isDateToday, isDateOverdue } from './utils.js';

export const DAYS_OF_WEEK = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
export const DAYS_OF_WEEK_FULL = Object.freeze([
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]);

export const MONTH_NAMES = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]);

export const SHORT_MONTH_NAMES = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]);

/**
 * Format year, month (0-11), and day (1-31) to YYYY-MM-DD.
 *
 * @param {number} year
 * @param {number} month - 0 to 11
 * @param {number} day - 1 to 31
 * @returns {string}
 */
export function formatCalendarDate(year, month, day) {
  const y = String(year).padStart(4, '0');
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get the number of days in a given month.
 * Automatically handles leap years for February.
 *
 * @param {number} year
 * @param {number} month - 0-indexed (0 = Jan, 11 = Dec)
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of the week for the first day of a month (0 = Sunday, 6 = Saturday).
 *
 * @param {number} year
 * @param {number} month - 0-indexed
 * @returns {number}
 */
export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

/**
 * Determine if a year is a leap year.
 *
 * @param {number} year
 * @returns {boolean}
 */
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Navigate to next or previous month.
 *
 * @param {number} year
 * @param {number} month - 0 to 11
 * @param {number} delta - e.g. -1 or +1
 * @returns {{ year: number, month: number }}
 */
export function navigateMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
  };
}

/**
 * Build the 35 or 42 grid cells for a monthly calendar view.
 * Includes preceding days from previous month and trailing days from next month.
 *
 * @param {number} year
 * @param {number} month - 0 to 11
 * @param {Date} [referenceDate]
 * @returns {Array<{
 *   dateString: string,
 *   dayNumber: number,
 *   month: number,
 *   year: number,
 *   isCurrentMonth: boolean,
 *   isToday: boolean,
 *   dayOfWeek: number
 * }>}
 */
export function getMonthGrid(year, month, referenceDate = new Date()) {
  const firstDay = getFirstDayOfMonth(year, month);
  const totalDays = getDaysInMonth(year, month);

  const prevMonthInfo = navigateMonth(year, month, -1);
  const prevMonthDays = getDaysInMonth(prevMonthInfo.year, prevMonthInfo.month);

  const cells = [];

  // 1. Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const dateString = formatCalendarDate(prevMonthInfo.year, prevMonthInfo.month, day);
    cells.push({
      dateString,
      dayNumber: day,
      month: prevMonthInfo.month,
      year: prevMonthInfo.year,
      isCurrentMonth: false,
      isToday: isDateToday(dateString, referenceDate),
      dayOfWeek: new Date(prevMonthInfo.year, prevMonthInfo.month, day).getDay(),
    });
  }

  // 2. Current month days
  for (let day = 1; day <= totalDays; day++) {
    const dateString = formatCalendarDate(year, month, day);
    cells.push({
      dateString,
      dayNumber: day,
      month,
      year,
      isCurrentMonth: true,
      isToday: isDateToday(dateString, referenceDate),
      dayOfWeek: new Date(year, month, day).getDay(),
    });
  }

  // 3. Next month leading days to complete full 7-day rows (up to 35 or 42)
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const daysToAdd = 7 - remainder;
    const nextMonthInfo = navigateMonth(year, month, 1);
    for (let day = 1; day <= daysToAdd; day++) {
      const dateString = formatCalendarDate(nextMonthInfo.year, nextMonthInfo.month, day);
      cells.push({
        dateString,
        dayNumber: day,
        month: nextMonthInfo.month,
        year: nextMonthInfo.year,
        isCurrentMonth: false,
        isToday: isDateToday(dateString, referenceDate),
        dayOfWeek: new Date(nextMonthInfo.year, nextMonthInfo.month, day).getDay(),
      });
    }
  }

  return cells;
}

/**
 * Get 7 days for the weekly view around a reference date (Sunday to Saturday).
 *
 * @param {Date|string} dateInput
 * @param {Date} [referenceDate]
 * @returns {Array<{
 *   dateString: string,
 *   dayNumber: number,
 *   dayName: string,
 *   dayFullName: string,
 *   month: number,
 *   year: number,
 *   isToday: boolean
 * }>}
 */
export function getWeekDays(dateInput = new Date(), referenceDate = new Date()) {
  const center = parseLocalDate(dateInput) || new Date();
  const dayOfWeek = center.getDay(); // 0 is Sunday

  const sunday = new Date(center.getFullYear(), center.getMonth(), center.getDate() - dayOfWeek);
  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    const dateString = formatCalendarDate(d.getFullYear(), d.getMonth(), d.getDate());
    days.push({
      dateString,
      dayNumber: d.getDate(),
      dayName: DAYS_OF_WEEK[i],
      dayFullName: DAYS_OF_WEEK_FULL[i],
      month: d.getMonth(),
      year: d.getFullYear(),
      isToday: isDateToday(dateString, referenceDate),
    });
  }

  return days;
}

/**
 * Group tasks into a Map keyed by due date (YYYY-MM-DD).
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @returns {Map<string, import('./tasks.js').Task[]>}
 */
export function groupTasksByDate(tasks) {
  const map = new Map();
  if (!Array.isArray(tasks)) return map;

  for (const task of tasks) {
    if (!task || !task.dueDate) continue;
    const dateKey = task.dueDate.slice(0, 10);
    if (!map.has(dateKey)) {
      map.set(dateKey, []);
    }
    map.get(dateKey).push(task);
  }

  return map;
}

/**
 * Get all tasks due on a specific calendar date (YYYY-MM-DD).
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {string} dateString - 'YYYY-MM-DD'
 * @returns {import('./tasks.js').Task[]}
 */
export function getTasksForDate(tasks, dateString) {
  if (!Array.isArray(tasks) || !dateString) return [];
  const target = dateString.slice(0, 10);
  return tasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === target);
}

/**
 * Compute status summary for tasks due on a date.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {Date} [referenceDate]
 * @returns {{ total: number, completed: number, pending: number, overdue: number, highPriority: number }}
 */
export function getDayTaskSummary(tasks, referenceDate = new Date()) {
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  let highPriority = 0;

  if (Array.isArray(tasks)) {
    for (const t of tasks) {
      if (t.status === 'completed' || t.completed) {
        completed++;
      } else {
        pending++;
        if (t.priority === 'high') highPriority++;
        if (t.dueDate && isDateOverdue(t.dueDate, referenceDate)) {
          overdue++;
        }
      }
    }
  }

  return {
    total: completed + pending,
    completed,
    pending,
    overdue,
    highPriority,
  };
}

export const HOURS_OF_DAY = Object.freeze(
  Array.from({ length: 24 }, (_, i) => {
    const hour24 = String(i).padStart(2, '0');
    const period = i >= 12 ? 'PM' : 'AM';
    const hour12 = i === 0 ? 12 : (i > 12 ? i - 12 : i);
    return Object.freeze({
      hour: i,
      timeString: `${hour24}:00`,
      label: `${hour12} ${period}`,
    });
  })
);

/**
 * Navigate to next or previous day.
 *
 * @param {string|Date} dateInput
 * @param {number} delta - e.g. -1 or +1
 * @returns {{ dateString: string, year: number, month: number, day: number }}
 */
export function navigateDay(dateInput, delta) {
  const d = parseLocalDate(dateInput) || new Date();
  d.setDate(d.getDate() + delta);
  return {
    dateString: formatCalendarDate(d.getFullYear(), d.getMonth(), d.getDate()),
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
  };
}

/**
 * Compute detailed day agenda breakdown with hourly timeline, all-day tasks, and overdue items.
 *
 * @param {string|Date} dateInput
 * @param {import('./tasks.js').Task[]} [tasks]
 * @param {Date} [referenceDate]
 * @returns {{
 *   dateString: string,
 *   year: number,
 *   month: number,
 *   monthName: string,
 *   shortMonthName: string,
 *   dayNumber: number,
 *   dayName: string,
 *   dayFullName: string,
 *   isToday: boolean,
 *   isOverdue: boolean,
 *   tasks: import('./tasks.js').Task[],
 *   allDayTasks: import('./tasks.js').Task[],
 *   timedTasks: import('./tasks.js').Task[],
 *   overdueTasks: import('./tasks.js').Task[],
 *   hourlySlots: Array<{ hour: number, timeString: string, label: string, tasks: import('./tasks.js').Task[] }>,
 *   summary: { total: number, completed: number, pending: number, overdue: number, highPriority: number }
 * }}
 */
export function getDayAgenda(dateInput, tasks = [], referenceDate = new Date()) {
  const parsed = parseLocalDate(dateInput) || new Date();
  const dateString = formatCalendarDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const dayOfWeek = parsed.getDay();

  const allScheduled = getTasksForDate(tasks, dateString);
  const overdueTasks = (Array.isArray(tasks) ? tasks : []).filter((t) => {
    if (!t || !t.dueDate || t.status === 'completed' || t.completed) return false;
    return t.dueDate.slice(0, 10) < dateString;
  });

  const allDayTasks = [];
  const timedTasks = [];
  const hourlySlots = HOURS_OF_DAY.map((slot) => ({
    hour: slot.hour,
    timeString: slot.timeString,
    label: slot.label,
    tasks: [],
  }));

  allScheduled.forEach((t) => {
    if (t.reminderTime && /^(\d{1,2}):(\d{2})$/.test(t.reminderTime.trim())) {
      const match = /^(\d{1,2}):(\d{2})$/.exec(t.reminderTime.trim());
      const hourNum = parseInt(match[1], 10);
      if (hourNum >= 0 && hourNum < 24) {
        hourlySlots[hourNum].tasks.push(t);
        timedTasks.push(t);
        return;
      }
    }
    allDayTasks.push(t);
  });

  const summary = getDayTaskSummary(allScheduled, referenceDate);

  return {
    dateString,
    year: parsed.getFullYear(),
    month: parsed.getMonth(),
    monthName: MONTH_NAMES[parsed.getMonth()],
    shortMonthName: SHORT_MONTH_NAMES[parsed.getMonth()],
    dayNumber: parsed.getDate(),
    dayName: DAYS_OF_WEEK[dayOfWeek],
    dayFullName: DAYS_OF_WEEK_FULL[dayOfWeek],
    isToday: isDateToday(dateString, referenceDate),
    isOverdue: isDateOverdue(dateString, referenceDate),
    tasks: allScheduled,
    allDayTasks,
    timedTasks,
    overdueTasks,
    hourlySlots,
    summary,
  };
}

