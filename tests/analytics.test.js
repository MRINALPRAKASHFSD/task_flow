/**
 * TaskFlow — tests/analytics.test.js
 * Unit test suite for productivity analytics, trends, category metrics, and SVG generation.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  TIME_FRAMES,
  filterTasksByTimeFrame,
  computeProductivityOverview,
  computeDailyCompletionTrends,
  computeWeeklyCompletionTrends,
  computeMonthlyCompletionTrends,
  computeCategoryAnalytics,
  computePriorityAnalytics,
  computePriorityWorkload,
  computeWorkloadTimeline,
  computeProductivityInsights,
  generateTrendChartSVG,
} from '../js/analytics.js';

describe('Productivity Analytics Time Frames & Filters', () => {
  test('TIME_FRAMES includes 7d, 30d, 90d, and all', () => {
    assert.deepEqual(TIME_FRAMES, ['7d', '30d', '90d', 'all']);
  });

  test('filterTasksByTimeFrame filters by cutoff date correctly', () => {
    const ref = new Date('2026-11-05T12:00:00Z');
    const tasks = [
      { id: '1', title: 'Today', createdAt: '2026-11-05T10:00:00Z' },
      { id: '2', title: '5 days ago', createdAt: '2026-10-31T10:00:00Z' },
      { id: '3', title: '15 days ago', createdAt: '2026-10-21T10:00:00Z' },
      { id: '4', title: '40 days ago', createdAt: '2026-09-26T10:00:00Z' },
    ];

    assert.equal(filterTasksByTimeFrame(tasks, '7d', ref).length, 2);
    assert.equal(filterTasksByTimeFrame(tasks, '30d', ref).length, 3);
    assert.equal(filterTasksByTimeFrame(tasks, 'all', ref).length, 4);
    assert.equal(filterTasksByTimeFrame([], '7d', ref).length, 0);
  });
});

describe('computeProductivityOverview', () => {
  test('returns zeros for empty task array', () => {
    const overview = computeProductivityOverview([]);
    assert.deepEqual(overview, {
      total: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      completionRate: 0,
      highPriorityPending: 0,
      averagePerDay: 0,
    });
  });

  test('computes counts, completion rate percentage, overdue items, and average per day', () => {
    const ref = new Date('2026-11-05T12:00:00Z');
    const tasks = [
      { id: '1', title: 'Done A', status: 'completed', completed: true, priority: 'high', dueDate: '2026-11-04' },
      { id: '2', title: 'Done B', status: 'completed', completed: true, priority: 'medium', dueDate: '2026-11-05' },
      { id: '3', title: 'Pending On Time', status: 'pending', completed: false, priority: 'low', dueDate: '2026-11-06' },
      { id: '4', title: 'Pending Overdue', status: 'pending', completed: false, priority: 'high', dueDate: '2026-11-01' },
    ];

    const overview = computeProductivityOverview(tasks, ref, 7);
    assert.equal(overview.total, 4);
    assert.equal(overview.completed, 2);
    assert.equal(overview.pending, 2);
    assert.equal(overview.overdue, 1);
    assert.equal(overview.highPriorityPending, 1);
    assert.equal(overview.completionRate, 50); // 2/4 = 50%
    assert.equal(overview.averagePerDay, 0.3); // 2 / 7 = 0.285... -> 0.3
  });

  test('computes all-time velocity using actual elapsed days from earliest createdAt', () => {
    const ref = new Date('2026-11-10T12:00:00Z');
    const tasks = [
      { id: '1', status: 'completed', completed: true, createdAt: '2026-11-01T00:00:00Z' },
      { id: '2', status: 'completed', completed: true, createdAt: '2026-11-05T00:00:00Z' },
      { id: '3', status: 'completed', completed: true, createdAt: '2026-11-08T00:00:00Z' },
    ];

    // Earliest is Nov 1, ref is Nov 10 => 10 elapsed days. 3 completed / 10 = 0.3
    const overview = computeProductivityOverview(tasks, ref, 'all');
    assert.equal(overview.total, 3);
    assert.equal(overview.completed, 3);
    assert.equal(overview.averagePerDay, 0.3);
  });

  test('handles 100% completed and 100% pending datasets cleanly', () => {
    const allDone = [
      { id: '1', status: 'completed', completed: true },
      { id: '2', status: 'completed', completed: true },
    ];
    const doneOverview = computeProductivityOverview(allDone);
    assert.equal(doneOverview.completionRate, 100);
    assert.equal(doneOverview.pending, 0);

    const allPending = [
      { id: '1', status: 'pending', completed: false },
      { id: '2', status: 'pending', completed: false },
    ];
    const pendingOverview = computeProductivityOverview(allPending);
    assert.equal(pendingOverview.completionRate, 0);
    assert.equal(pendingOverview.completed, 0);
    assert.equal(pendingOverview.pending, 2);
  });
});

describe('computeDailyCompletionTrends', () => {
  test('generates expected number of daily points with labels', () => {
    const ref = new Date('2026-11-05T12:00:00Z');
    const tasks = [
      { id: '1', status: 'completed', completed: true, updatedAt: '2026-11-05T08:00:00Z' },
      { id: '2', status: 'completed', completed: true, updatedAt: '2026-11-05T09:00:00Z' },
      { id: '3', status: 'completed', completed: true, updatedAt: '2026-11-04T10:00:00Z' },
    ];

    const trends = computeDailyCompletionTrends(tasks, 7, ref);
    assert.equal(trends.length, 7);

    // Latest day is 2026-11-05
    const latest = trends[trends.length - 1];
    assert.equal(latest.dateString, '2026-11-05');
    assert.equal(latest.completedCount, 2);

    // Previous day is 2026-11-04
    const prev = trends[trends.length - 2];
    assert.equal(prev.dateString, '2026-11-04');
    assert.equal(prev.completedCount, 1);
  });
});

describe('computeCategoryAnalytics & computePriorityAnalytics', () => {
  const tasks = [
    { id: '1', category: 'Work', status: 'completed', completed: true, priority: 'high' },
    { id: '2', category: 'Work', status: 'pending', completed: false, priority: 'high' },
    { id: '3', category: 'Study', status: 'completed', completed: true, priority: 'medium' },
    { id: '4', category: 'Health', status: 'pending', completed: false, priority: 'low' },
  ];

  test('groups tasks by category and computes completion rates', () => {
    const catAnalytics = computeCategoryAnalytics(tasks);
    assert.equal(catAnalytics.length, 3);

    const work = catAnalytics.find((c) => c.category === 'Work');
    assert.ok(work);
    assert.equal(work.total, 2);
    assert.equal(work.completed, 1);
    assert.equal(work.pending, 1);
    assert.equal(work.rate, 50);

    const study = catAnalytics.find((c) => c.category === 'Study');
    assert.equal(study.rate, 100);
  });

  test('computes priority breakdown and percentages accurately', () => {
    const prioAnalytics = computePriorityAnalytics(tasks);
    assert.equal(prioAnalytics.high.total, 2);
    assert.equal(prioAnalytics.high.percentage, 50);
    assert.equal(prioAnalytics.medium.total, 1);
    assert.equal(prioAnalytics.medium.percentage, 25);
    assert.equal(prioAnalytics.low.total, 1);
    assert.equal(prioAnalytics.low.percentage, 25);
  });
});

describe('computeProductivityInsights & generateTrendChartSVG', () => {
  test('returns default insight when task list is empty', () => {
    const insights = computeProductivityInsights([]);
    assert.equal(insights.length, 1);
    assert.match(insights[0].text, /create your first task/i);
  });

  test('extracts insights based on actual progress and overdue counts', () => {
    const ref = new Date('2026-11-05T12:00:00Z');
    const tasks = [
      { id: '1', category: 'Work', status: 'completed', completed: true, priority: 'high', updatedAt: '2026-11-05' },
      { id: '2', category: 'Work', status: 'completed', completed: true, priority: 'medium', updatedAt: '2026-11-05' },
      { id: '3', category: 'Work', status: 'pending', completed: false, priority: 'low', dueDate: '2026-11-01' },
    ];

    const insights = computeProductivityInsights(tasks, ref);
    assert.ok(insights.length >= 2);
    assert.ok(insights.some((i) => i.type === 'positive'));
    assert.ok(insights.some((i) => i.type === 'warning')); // overdue task exists
  });

  test('generateTrendChartSVG produces accessible semantic SVG', () => {
    const data = [
      { label: 'Mon', completedCount: 3 },
      { label: 'Tue', completedCount: 5 },
      { label: 'Wed', completedCount: 2 },
    ];

    const svg = generateTrendChartSVG(data, { width: 400, height: 160 });
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('role="img"'));
    assert.ok(svg.includes('aria-label="Productivity Trend Chart"'));
    assert.ok(svg.includes('<rect'));
    assert.ok(svg.includes('<text'));
  });
});

// ─── Phase 3.2: Analytics Dashboard Enhancements ─────────────────────────────

describe('Weekly & Monthly Completion Trends', () => {
  const ref = new Date('2026-11-08T12:00:00Z'); // Sunday Nov 8, 2026

  test('computeWeeklyCompletionTrends groups tasks into 8 consecutive calendar weeks', () => {
    const tasks = [
      { id: '1', status: 'completed', completed: true, updatedAt: '2026-11-08T09:00:00Z', createdAt: '2026-11-08T08:00:00Z' },
      { id: '2', status: 'completed', completed: true, updatedAt: '2026-11-04T10:00:00Z', createdAt: '2026-11-03T10:00:00Z' },
      { id: '3', status: 'pending', completed: false, createdAt: '2026-11-01T10:00:00Z' },
    ];

    const weeks = computeWeeklyCompletionTrends(tasks, 8, ref);
    assert.equal(weeks.length, 8);

    // Current week (starts Nov 8)
    const currentWeek = weeks[weeks.length - 1];
    assert.equal(currentWeek.completedCount, 1);
    assert.equal(currentWeek.createdCount, 1);

    // Previous week (Nov 1 – Nov 7)
    const prevWeek = weeks[weeks.length - 2];
    assert.equal(prevWeek.completedCount, 1);
    assert.equal(prevWeek.createdCount, 2);
  });

  test('computeWeeklyCompletionTrends smoothly spans year boundaries', () => {
    const newYearRef = new Date('2027-01-05T12:00:00Z');
    const weeks = computeWeeklyCompletionTrends([], 4, newYearRef);
    assert.equal(weeks.length, 4);
    assert.ok(weeks.some(w => w.weekStart.startsWith('2026-12') || w.weekEnd.startsWith('2027-01')));
  });

  test('computeMonthlyCompletionTrends groups tasks by calendar month prefix', () => {
    const tasks = [
      { id: '1', status: 'completed', completed: true, updatedAt: '2026-11-02T10:00:00Z', createdAt: '2026-11-01T10:00:00Z' },
      { id: '2', status: 'completed', completed: true, updatedAt: '2026-10-15T10:00:00Z', createdAt: '2026-10-10T10:00:00Z' },
      { id: '3', status: 'pending', completed: false, createdAt: '2026-10-20T10:00:00Z' },
    ];

    const months = computeMonthlyCompletionTrends(tasks, 6, ref);
    assert.equal(months.length, 6);

    // Latest month is Nov 2026
    const nov = months[months.length - 1];
    assert.equal(nov.year, 2026);
    assert.equal(nov.month, 10); // 0-indexed November
    assert.equal(nov.completedCount, 1);
    assert.equal(nov.createdCount, 1);

    // October 2026
    const oct = months[months.length - 2];
    assert.equal(oct.completedCount, 1);
    assert.equal(oct.createdCount, 2);
  });
});

describe('Category Analytics Standard Coverage & Stacked Metrics', () => {
  test('includes all six standard categories when includeStandard is true', () => {
    const tasks = [
      { id: '1', category: 'Work', status: 'completed', completed: true },
      { id: '2', category: 'Work', status: 'pending', completed: false },
    ];

    const catStats = computeCategoryAnalytics(tasks, true);
    assert.equal(catStats.length, 6);

    const work = catStats.find(c => c.category === 'Work');
    assert.equal(work.total, 2);
    assert.equal(work.completed, 1);
    assert.equal(work.pending, 1);
    assert.equal(work.rate, 50);
    assert.equal(work.pendingRate, 50);

    const health = catStats.find(c => c.category === 'Health');
    assert.equal(health.total, 0);
    assert.equal(health.completed, 0);
    assert.equal(health.pending, 0);
    assert.equal(health.rate, 0);
    assert.equal(health.pendingRate, 0);
  });

  test('sum of category totals strictly equals task count without double counting', () => {
    const tasks = [
      { id: '1', category: 'Work', status: 'completed', completed: true },
      { id: '2', category: 'Personal', status: 'pending', completed: false },
      { id: '3', category: 'CustomLab', status: 'pending', completed: false },
    ];

    const catStats = computeCategoryAnalytics(tasks, true);
    const sumTotals = catStats.reduce((acc, c) => acc + c.total, 0);
    assert.equal(sumTotals, 3);
  });
});

describe('Priority Workload & Overdue Breakdown', () => {
  const ref = new Date('2026-11-08T12:00:00Z');

  test('computePriorityAnalytics calculates pending share and excludes completed tasks from overdue', () => {
    const tasks = [
      { id: '1', priority: 'high', status: 'completed', completed: true, dueDate: '2026-11-01' }, // completed, NOT overdue
      { id: '2', priority: 'high', status: 'pending', completed: false, dueDate: '2026-11-01' },   // pending, overdue
      { id: '3', priority: 'medium', status: 'pending', completed: false, dueDate: '2026-11-10' }, // pending, on time
      { id: '4', priority: 'low', status: 'pending', completed: false },                           // pending, unscheduled
    ];

    const stats = computePriorityAnalytics(tasks, ref);
    assert.equal(stats.high.total, 2);
    assert.equal(stats.high.completed, 1);
    assert.equal(stats.high.pending, 1);
    assert.equal(stats.high.overdue, 1); // Only the pending one is overdue
    assert.equal(stats.high.percentage, 50); // 2 of 4 tasks = 50%
    assert.equal(stats.high.pendingShare, 33); // 1 of 3 pending tasks = 33%

    assert.equal(stats.medium.overdue, 0);
    assert.equal(stats.low.overdue, 0);
  });
});

describe('Workload Timeline Horizon Classification', () => {
  const ref = new Date('2026-11-08T12:00:00Z'); // 2026-11-08

  test('classifies each pending task into exactly one mutually exclusive horizon bucket', () => {
    const tasks = [
      { id: '1', status: 'completed', completed: true, dueDate: '2026-11-01' }, // Completed: EXCLUDED
      { id: '2', status: 'pending', completed: false, dueDate: '2026-11-05' },   // Overdue
      { id: '3', status: 'pending', completed: false, dueDate: '2026-11-08' },   // Due Today
      { id: '4', status: 'pending', completed: false, dueDate: '2026-11-12' },   // Due This Week (<= Nov 15)
      { id: '5', status: 'pending', completed: false, dueDate: '2026-11-20' },   // Due Later (> Nov 15)
      { id: '6', status: 'pending', completed: false, dueDate: null },           // Unscheduled
    ];

    const horizon = computeWorkloadTimeline(tasks, ref);
    assert.equal(horizon.totalPending, 5);
    assert.equal(horizon.overdue, 1);
    assert.equal(horizon.today, 1);
    assert.equal(horizon.thisWeek, 1);
    assert.equal(horizon.later, 1);
    assert.equal(horizon.unscheduled, 1);

    const sumBuckets = horizon.overdue + horizon.today + horizon.thisWeek + horizon.later + horizon.unscheduled;
    assert.equal(sumBuckets, horizon.totalPending);
  });

  test('empty pending task list returns all zero horizon metrics', () => {
    const horizon = computeWorkloadTimeline([], ref);
    assert.equal(horizon.totalPending, 0);
    assert.equal(horizon.overdue, 0);
    assert.equal(horizon.today, 0);
    assert.equal(horizon.thisWeek, 0);
    assert.equal(horizon.later, 0);
    assert.equal(horizon.unscheduled, 0);
  });
});

