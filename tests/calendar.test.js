/**
 * TaskFlow — tests/calendar.test.js
 * Unit test suite for calendar engine calculations, leap years, grids, and task grouping.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAYS_OF_WEEK,
  DAYS_OF_WEEK_FULL,
  MONTH_NAMES,
  SHORT_MONTH_NAMES,
  formatCalendarDate,
  getDaysInMonth,
  getFirstDayOfMonth,
  isLeapYear,
  navigateMonth,
  getMonthGrid,
  getWeekDays,
  groupTasksByDate,
  getTasksForDate,
  getDayTaskSummary,
  HOURS_OF_DAY,
  navigateDay,
  navigateWeek,
  formatWeekTitle,
  getDayAgenda,
} from '../js/calendar.js';

import { createTask, toggleTaskStatus } from '../js/tasks.js';
import { parseLocalDate, isValidDateString } from '../js/utils.js';

describe('Calendar Constants & Date Formatting', () => {
  test('constants contain 7 days and 12 months', () => {
    assert.equal(DAYS_OF_WEEK.length, 7);
    assert.equal(MONTH_NAMES.length, 12);
    assert.equal(DAYS_OF_WEEK[0], 'Sun');
    assert.equal(MONTH_NAMES[0], 'January');
  });

  test('formatCalendarDate produces zero-padded YYYY-MM-DD', () => {
    assert.equal(formatCalendarDate(2026, 0, 5), '2026-01-05');
    assert.equal(formatCalendarDate(2026, 11, 25), '2026-12-25');
  });
});

describe('Leap Year & Month Days Calculation', () => {
  test('detects leap years correctly', () => {
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2020), true);
    assert.equal(isLeapYear(2000), true);
    assert.equal(isLeapYear(2026), false);
    assert.equal(isLeapYear(2025), false);
    assert.equal(isLeapYear(1900), false);
  });

  test('February has 29 days in leap year and 28 in non-leap year', () => {
    assert.equal(getDaysInMonth(2024, 1), 29);
    assert.equal(getDaysInMonth(2025, 1), 28);
    assert.equal(getDaysInMonth(2026, 1), 28);
  });

  test('standard months have 30 or 31 days', () => {
    assert.equal(getDaysInMonth(2026, 0), 31); // January
    assert.equal(getDaysInMonth(2026, 3), 30); // April
    assert.equal(getDaysInMonth(2026, 6), 31); // July
    assert.equal(getDaysInMonth(2026, 7), 31); // August
    assert.equal(getDaysInMonth(2026, 8), 30); // September
  });

  test('getFirstDayOfMonth returns correct weekday', () => {
    // 2026-01-01 is a Thursday (4)
    assert.equal(getFirstDayOfMonth(2026, 0), 4);
    // 2026-02-01 is a Sunday (0)
    assert.equal(getFirstDayOfMonth(2026, 1), 0);
  });
});

describe('Month Navigation', () => {
  test('advances to next month in same year', () => {
    const next = navigateMonth(2026, 2, 1);
    assert.deepEqual(next, { year: 2026, month: 3 });
  });

  test('advances across year boundary into next year', () => {
    const next = navigateMonth(2026, 11, 1);
    assert.deepEqual(next, { year: 2027, month: 0 });
  });

  test('retreats across year boundary into previous year', () => {
    const prev = navigateMonth(2026, 0, -1);
    assert.deepEqual(prev, { year: 2025, month: 11 });
  });
});

describe('Month Grid Construction', () => {
  test('generates valid grid with length divisible by 7 (35 or 42)', () => {
    const ref = new Date(2026, 10, 5); // 2026-11-05
    const gridNov2026 = getMonthGrid(2026, 10, ref);
    assert.ok(gridNov2026.length === 35 || gridNov2026.length === 42);
    assert.equal(gridNov2026.length % 7, 0);

    // November 2026 has 30 days
    const currentMonthDays = gridNov2026.filter((c) => c.isCurrentMonth);
    assert.equal(currentMonthDays.length, 30);

    // Verify today marker is present on 2026-11-05
    const todayCell = gridNov2026.find((c) => c.isToday);
    assert.ok(todayCell);
    assert.equal(todayCell.dateString, '2026-11-05');
  });

  test('February 2026 starts on Sunday and fills exactly 35 or 28 cells', () => {
    const grid = getMonthGrid(2026, 1);
    assert.equal(grid.length % 7, 0);
    assert.equal(grid.filter((c) => c.isCurrentMonth).length, 28);
  });
});

describe('Weekly View Calculations', () => {
  test('returns 7 consecutive days starting on Sunday', () => {
    const ref = new Date(2026, 10, 5); // Thursday Nov 5, 2026
    const week = getWeekDays(ref, ref);

    assert.equal(week.length, 7);
    assert.equal(week[0].dayName, 'Sun');
    assert.equal(week[0].dateString, '2026-11-01');
    assert.equal(week[4].dateString, '2026-11-05');
    assert.equal(week[4].isToday, true);
    assert.equal(week[6].dayName, 'Sat');
    assert.equal(week[6].dateString, '2026-11-07');
  });
});

describe('Task Grouping & Calendar Queries', () => {
  const dummyTasks = [
    { id: '1', title: 'Task A', dueDate: '2026-11-05', status: 'pending', completed: false, priority: 'high' },
    { id: '2', title: 'Task B', dueDate: '2026-11-05', status: 'completed', completed: true, priority: 'medium' },
    { id: '3', title: 'Task C', dueDate: '2026-11-06', status: 'pending', completed: false, priority: 'low' },
    { id: '4', title: 'Task D', dueDate: '2026-11-01', status: 'pending', completed: false, priority: 'high' },
    { id: '5', title: 'No due date task', dueDate: null, status: 'pending', completed: false },
  ];

  test('groupTasksByDate groups tasks into Map by YYYY-MM-DD', () => {
    const map = groupTasksByDate(dummyTasks);
    assert.ok(map instanceof Map);
    assert.equal(map.get('2026-11-05').length, 2);
    assert.equal(map.get('2026-11-06').length, 1);
    assert.equal(map.get('2026-11-01').length, 1);
    assert.equal(map.has(null), false);
  });

  test('getTasksForDate filters tasks for target date string', () => {
    const tasksOn5th = getTasksForDate(dummyTasks, '2026-11-05');
    assert.equal(tasksOn5th.length, 2);
    assert.equal(tasksOn5th[0].id, '1');
    assert.equal(tasksOn5th[1].id, '2');

    const tasksOnEmpty = getTasksForDate(dummyTasks, '2026-11-20');
    assert.equal(tasksOnEmpty.length, 0);
  });

  test('getDayTaskSummary calculates accurate counts including overdue and high priority', () => {
    const refDate = new Date(2026, 10, 5); // 2026-11-05
    const tasksOn5th = getTasksForDate(dummyTasks, '2026-11-05');
    const summary5th = getDayTaskSummary(tasksOn5th, refDate);

    assert.equal(summary5th.total, 2);
    assert.equal(summary5th.pending, 1);
    assert.equal(summary5th.completed, 1);
    assert.equal(summary5th.highPriority, 1);
    assert.equal(summary5th.overdue, 0);

    const pastTasks = getTasksForDate(dummyTasks, '2026-11-01');
    const pastSummary = getDayTaskSummary(pastTasks, refDate);
    assert.equal(pastSummary.total, 1);
    assert.equal(pastSummary.pending, 1);
    assert.equal(pastSummary.overdue, 1);
  });
});

describe('Calendar Day View & Hourly Agenda Calculations', () => {
  const dayTestTasks = [
    { id: '1', title: 'Morning Standup', dueDate: '2026-11-05', reminderTime: '09:00', status: 'pending', completed: false, priority: 'high' },
    { id: '2', title: 'Lunch & Learn', dueDate: '2026-11-05', reminderTime: '12:30', status: 'completed', completed: true, priority: 'low' },
    { id: '3', title: 'All Day Objective', dueDate: '2026-11-05', reminderTime: null, status: 'pending', completed: false, priority: 'medium' },
    { id: '4', title: 'Old Overdue Task', dueDate: '2026-11-02', reminderTime: '10:00', status: 'pending', completed: false, priority: 'high' },
    { id: '5', title: 'Future Task', dueDate: '2026-11-08', reminderTime: '15:00', status: 'pending', completed: false, priority: 'medium' },
  ];

  test('HOURS_OF_DAY defines 24 sequential hourly slots', () => {
    assert.equal(HOURS_OF_DAY.length, 24);
    assert.equal(HOURS_OF_DAY[0].hour, 0);
    assert.equal(HOURS_OF_DAY[0].label, '12 AM');
    assert.equal(HOURS_OF_DAY[9].hour, 9);
    assert.equal(HOURS_OF_DAY[9].label, '9 AM');
    assert.equal(HOURS_OF_DAY[12].hour, 12);
    assert.equal(HOURS_OF_DAY[12].label, '12 PM');
    assert.equal(HOURS_OF_DAY[23].hour, 23);
    assert.equal(HOURS_OF_DAY[23].label, '11 PM');
  });

  test('navigateDay advances and retreats across day, month, and year boundaries', () => {
    const nextDay = navigateDay('2026-11-05', 1);
    assert.equal(nextDay.dateString, '2026-11-06');

    const prevDay = navigateDay('2026-11-05', -1);
    assert.equal(prevDay.dateString, '2026-11-04');

    const crossMonth = navigateDay('2026-11-30', 1);
    assert.equal(crossMonth.dateString, '2026-12-01');
    assert.equal(crossMonth.month, 11);

    const crossYear = navigateDay('2026-12-31', 1);
    assert.equal(crossYear.dateString, '2027-01-01');
    assert.equal(crossYear.year, 2027);

    const prevCrossYear = navigateDay('2026-01-01', -1);
    assert.equal(prevCrossYear.dateString, '2025-12-31');
    assert.equal(prevCrossYear.year, 2025);
  });

  test('getDayAgenda builds complete hourly breakdown, all-day tasks, and overdue list', () => {
    const refDate = new Date(2026, 10, 5); // 2026-11-05
    const agenda = getDayAgenda('2026-11-05', dayTestTasks, refDate);

    assert.equal(agenda.dateString, '2026-11-05');
    assert.equal(agenda.dayFullName, 'Thursday');
    assert.equal(agenda.dayNumber, 5);
    assert.equal(agenda.monthName, 'November');
    assert.equal(agenda.year, 2026);
    assert.equal(agenda.isToday, true);

    // Tasks scheduled on Nov 5: 3 total
    assert.equal(agenda.tasks.length, 3);

    // All-day tasks: Task 3 (no reminderTime)
    assert.equal(agenda.allDayTasks.length, 1);
    assert.equal(agenda.allDayTasks[0].id, '3');

    // Timed tasks: Task 1 (09:00) and Task 2 (12:30)
    assert.equal(agenda.timedTasks.length, 2);

    // Hourly slot distribution
    const slot9am = agenda.hourlySlots.find(s => s.hour === 9);
    assert.ok(slot9am);
    assert.equal(slot9am.tasks.length, 1);
    assert.equal(slot9am.tasks[0].id, '1');

    const slot12pm = agenda.hourlySlots.find(s => s.hour === 12);
    assert.ok(slot12pm);
    assert.equal(slot12pm.tasks.length, 1);
    assert.equal(slot12pm.tasks[0].id, '2');

    const slot8am = agenda.hourlySlots.find(s => s.hour === 8);
    assert.ok(slot8am);
    assert.equal(slot8am.tasks.length, 0);

    // Overdue tasks: Task 4 (due 2026-11-02, pending)
    assert.equal(agenda.overdueTasks.length, 1);
    assert.equal(agenda.overdueTasks[0].id, '4');

    // Summary calculations
    assert.equal(agenda.summary.total, 3);
    assert.equal(agenda.summary.pending, 2);
    assert.equal(agenda.summary.completed, 1);
    assert.equal(agenda.summary.highPriority, 1);
  });
});

// ─── Phase 3.1: Calendar Navigation, Alignment & Task Integration ────────────

describe('Calendar Week Navigation & formatWeekTitle', () => {
  test('navigateWeek advances by 7 days', () => {
    const next = navigateWeek('2026-11-05', 1);
    assert.equal(next.dateString, '2026-11-12');
    assert.equal(next.year, 2026);
    assert.equal(next.month, 10);
    assert.equal(next.day, 12);
  });

  test('navigateWeek retreats by 7 days', () => {
    const prev = navigateWeek('2026-11-05', -1);
    assert.equal(prev.dateString, '2026-10-29');
    assert.equal(prev.year, 2026);
    assert.equal(prev.month, 9);
    assert.equal(prev.day, 29);
  });

  test('navigateWeek crosses year boundaries smoothly', () => {
    const crossYear = navigateWeek('2026-12-28', 1);
    assert.equal(crossYear.dateString, '2027-01-04');
    assert.equal(crossYear.year, 2027);
    assert.equal(crossYear.month, 0);

    const prevCrossYear = navigateWeek('2026-01-04', -1);
    assert.equal(prevCrossYear.dateString, '2025-12-28');
    assert.equal(prevCrossYear.year, 2025);
    assert.equal(prevCrossYear.month, 11);
  });

  test('formatWeekTitle formats same-month week span correctly', () => {
    const week = getWeekDays('2026-11-04');
    const title = formatWeekTitle(week);
    assert.equal(title, 'November 1 – 7, 2026');
  });

  test('formatWeekTitle formats cross-month week span in same year', () => {
    const week = getWeekDays('2026-11-30');
    const title = formatWeekTitle(week);
    assert.equal(title, 'Nov 29 – Dec 5, 2026');
  });

  test('formatWeekTitle formats cross-year week span', () => {
    const week = getWeekDays('2026-12-31');
    const title = formatWeekTitle(week);
    assert.equal(title, 'Dec 27, 2026 – Jan 2, 2027');
  });
});

describe('Month Grid Alignment & Boundary Edge Cases', () => {
  test('aligns November 2026 starting on Sunday with 30 days', () => {
    const grid = getMonthGrid(2026, 10);
    assert.equal(grid[0].dayOfWeek, 0);
    assert.equal(grid[0].dateString, '2026-11-01');
    assert.equal(grid[0].isCurrentMonth, true);
    assert.equal(grid.filter(c => c.isCurrentMonth).length, 30);
  });

  test('aligns January 2026 starting on Thursday with 3 trailing December days', () => {
    const grid = getMonthGrid(2026, 0);
    // Sunday Dec 28, Mon Dec 29, Tue Dec 30, Wed Dec 31
    assert.equal(grid[0].dateString, '2025-12-28');
    assert.equal(grid[0].isCurrentMonth, false);
    assert.equal(grid[4].dateString, '2026-01-01');
    assert.equal(grid[4].isCurrentMonth, true);
    assert.equal(grid.filter(c => c.isCurrentMonth).length, 31);
  });

  test('leap-year February 2024 has 29 current month days', () => {
    const grid2024 = getMonthGrid(2024, 1);
    const feb2024Days = grid2024.filter(c => c.isCurrentMonth);
    assert.equal(feb2024Days.length, 29);
    assert.equal(feb2024Days[28].dateString, '2024-02-29');
  });

  test('non-leap February 2025 and 2026 have exactly 28 days', () => {
    const grid2025 = getMonthGrid(2025, 1);
    assert.equal(grid2025.filter(c => c.isCurrentMonth).length, 28);

    const grid2026 = getMonthGrid(2026, 1);
    assert.equal(grid2026.filter(c => c.isCurrentMonth).length, 28);
  });

  test('every month of year generates grid with length divisible by 7', () => {
    for (let m = 0; m < 12; m++) {
      const grid = getMonthGrid(2026, m);
      assert.equal(grid.length % 7, 0, `Month ${m} grid length must be multiple of 7`);
      assert.ok(grid.length === 28 || grid.length === 35 || grid.length === 42, `Month ${m} should have 28, 35, or 42 cells`);
    }
  });
});

describe('Task Scheduling, Date Matching & Empty Dates', () => {
  const scheduledTasks = [
    createTask({ title: 'Task on 7th', dueDate: '2026-11-07', priority: 'high', category: 'Work' }),
    createTask({ title: 'Another on 7th', dueDate: '2026-11-07', priority: 'medium', category: 'Study' }),
    createTask({ title: 'Task on 15th', dueDate: '2026-11-15', priority: 'low', category: 'Health' }),
  ];

  test('tasks appear only on their scheduled date', () => {
    const tasksOn7th = getTasksForDate(scheduledTasks, '2026-11-07');
    assert.equal(tasksOn7th.length, 2);
    assert.equal(tasksOn7th[0].title, 'Task on 7th');
    assert.equal(tasksOn7th[1].title, 'Another on 7th');

    const tasksOn15th = getTasksForDate(scheduledTasks, '2026-11-15');
    assert.equal(tasksOn15th.length, 1);
    assert.equal(tasksOn15th[0].title, 'Task on 15th');
  });

  test('empty dates return zero tasks and zero summary counts', () => {
    const tasksOnEmpty = getTasksForDate(scheduledTasks, '2026-11-10');
    assert.equal(tasksOnEmpty.length, 0);

    const summary = getDayTaskSummary(tasksOnEmpty);
    assert.equal(summary.total, 0);
    assert.equal(summary.pending, 0);
    assert.equal(summary.completed, 0);
    assert.equal(summary.overdue, 0);
    assert.equal(summary.highPriority, 0);
  });

  test('completed tasks are counted in summary and preserved on date', () => {
    const tPending = createTask({ title: 'Pending Task', dueDate: '2026-11-07' });
    const tCompleted = toggleTaskStatus(createTask({ title: 'Completed Task', dueDate: '2026-11-07' }));
    const tasks = [tPending, tCompleted];

    const tasksOnDate = getTasksForDate(tasks, '2026-11-07');
    assert.equal(tasksOnDate.length, 2);

    const summary = getDayTaskSummary(tasksOnDate, new Date(2026, 10, 7));
    assert.equal(summary.total, 2);
    assert.equal(summary.pending, 1);
    assert.equal(summary.completed, 1);
  });
});

describe('Calendar Date Selection & Agenda Details', () => {
  test('getDayAgenda produces complete structured day breakdown', () => {
    const tasks = [
      createTask({ title: 'Standup', dueDate: '2026-11-07', reminderTime: '09:30', priority: 'medium' }),
      createTask({ title: 'Deploy', dueDate: '2026-11-07', reminderTime: null, priority: 'high' }),
    ];
    const agenda = getDayAgenda('2026-11-07', tasks, new Date(2026, 10, 7));

    assert.equal(agenda.dateString, '2026-11-07');
    assert.equal(agenda.dayFullName, 'Saturday');
    assert.equal(agenda.dayNumber, 7);
    assert.equal(agenda.monthName, 'November');
    assert.equal(agenda.year, 2026);
    assert.equal(agenda.isToday, true);

    assert.equal(agenda.tasks.length, 2);
    assert.equal(agenda.allDayTasks.length, 1);
    assert.equal(agenda.allDayTasks[0].title, 'Deploy');
    assert.equal(agenda.timedTasks.length, 1);
    assert.equal(agenda.timedTasks[0].title, 'Standup');

    // 09:30 slots into 9 AM hourly slot
    const slot9 = agenda.hourlySlots.find(s => s.hour === 9);
    assert.ok(slot9);
    assert.equal(slot9.tasks.length, 1);
    assert.equal(slot9.tasks[0].title, 'Standup');
  });

  test('getDayAgenda returns clean empty agenda for dates without tasks', () => {
    const agenda = getDayAgenda('2026-11-20', [], new Date(2026, 10, 7));
    assert.equal(agenda.dateString, '2026-11-20');
    assert.equal(agenda.tasks.length, 0);
    assert.equal(agenda.allDayTasks.length, 0);
    assert.equal(agenda.timedTasks.length, 0);
    assert.equal(agenda.overdueTasks.length, 0);
    assert.equal(agenda.summary.total, 0);
  });
});

describe('Date and Timezone Safety Hardening', () => {
  test('tasks around local midnight stay on their scheduled date without shifting', () => {
    const tasks = [
      createTask({ title: 'Midnight Exact', dueDate: '2026-11-08', reminderTime: '00:00' }),
      createTask({ title: 'Just after Midnight', dueDate: '2026-11-08', reminderTime: '00:01' }),
      createTask({ title: 'Just before Midnight', dueDate: '2026-11-08', reminderTime: '23:59' }),
    ];

    const tasksOn8th = getTasksForDate(tasks, '2026-11-08');
    assert.equal(tasksOn8th.length, 3);
    assert.equal(getTasksForDate(tasks, '2026-11-07').length, 0);
    assert.equal(getTasksForDate(tasks, '2026-11-09').length, 0);

    const agenda = getDayAgenda('2026-11-08', tasks);
    assert.equal(agenda.tasks.length, 3);
    // 00:00 and 00:01 map to hour 0
    const slot0 = agenda.hourlySlots.find(s => s.hour === 0);
    assert.equal(slot0.tasks.length, 2);
    // 23:59 maps to hour 23
    const slot23 = agenda.hourlySlots.find(s => s.hour === 23);
    assert.equal(slot23.tasks.length, 1);
  });

  test('dates crossing month and year boundaries navigate accurately', () => {
    // Year boundary
    const nextYear = navigateDay('2026-12-31', 1);
    assert.equal(nextYear.dateString, '2027-01-01');
    assert.equal(nextYear.year, 2027);
    assert.equal(nextYear.month, 0);
    assert.equal(nextYear.day, 1);

    const prevYear = navigateDay('2027-01-01', -1);
    assert.equal(prevYear.dateString, '2026-12-31');
    assert.equal(prevYear.year, 2026);
    assert.equal(prevYear.month, 11);
    assert.equal(prevYear.day, 31);

    // Non-leap February to March
    const nonLeapNext = navigateDay('2026-02-28', 1);
    assert.equal(nonLeapNext.dateString, '2026-03-01');

    // Leap February to March
    const leapNext = navigateDay('2024-02-28', 1);
    assert.equal(leapNext.dateString, '2024-02-29');
    const leapNext2 = navigateDay('2024-02-29', 1);
    assert.equal(leapNext2.dateString, '2024-03-01');
  });

  test('date parsing from YYYY-MM-DD validates leap-year February correctly', () => {
    // Valid leap day
    const validLeap = parseLocalDate('2024-02-29');
    assert.ok(validLeap);
    assert.equal(validLeap.getFullYear(), 2024);
    assert.equal(validLeap.getMonth(), 1); // 0-indexed Feb
    assert.equal(validLeap.getDate(), 29);

    // Invalid leap day in non-leap year
    const invalidLeap = parseLocalDate('2025-02-29');
    assert.equal(invalidLeap, null);

    const invalidLeap2026 = parseLocalDate('2026-02-29');
    assert.equal(invalidLeap2026, null);

    // Standard valid date
    const validStandard = parseLocalDate('2026-11-08');
    assert.ok(validStandard);
    assert.equal(validStandard.getFullYear(), 2026);
    assert.equal(validStandard.getMonth(), 10);
    assert.equal(validStandard.getDate(), 8);
  });

  test('stored dueDate strings are rendered consistently without UTC shifts', () => {
    const task = createTask({ title: 'Timezone Invariant Task', dueDate: '2026-07-15' });

    // String-based matching ensures that date does not shift when user timezone varies
    assert.equal(getTasksForDate([task], '2026-07-15').length, 1);
    assert.equal(getTasksForDate([task], '2026-07-14').length, 0);
    assert.equal(getTasksForDate([task], '2026-07-16').length, 0);

    // Grouping by date preserves exact YYYY-MM-DD keys
    const map = groupTasksByDate([task]);
    assert.ok(map.has('2026-07-15'));
    assert.equal(map.get('2026-07-15').length, 1);
  });

  test('reminderTime semantics: reminder is distinct from scheduled start time and does not shift dueDate', () => {
    const task = createTask({
      title: 'Doctor Appointment',
      dueDate: '2026-11-08',
      reminderTime: '14:30',
    });

    // Task stays scheduled on its due date
    assert.equal(task.dueDate, '2026-11-08');
    assert.equal(task.reminderTime, '14:30');

    // Day agenda assigns it to the 14:00 reminder timeline slot
    const agenda = getDayAgenda('2026-11-08', [task]);
    assert.equal(agenda.allDayTasks.length, 0);
    assert.equal(agenda.timedTasks.length, 1);
    const slot14 = agenda.hourlySlots.find(s => s.hour === 14);
    assert.ok(slot14);
    assert.equal(slot14.tasks[0].title, 'Doctor Appointment');

    // Untimed task stays in allDayTasks without error
    const untimed = createTask({ title: 'Review PR', dueDate: '2026-11-08', reminderTime: null });
    const agenda2 = getDayAgenda('2026-11-08', [untimed]);
    assert.equal(agenda2.allDayTasks.length, 1);
    assert.equal(agenda2.timedTasks.length, 0);
  });
});


