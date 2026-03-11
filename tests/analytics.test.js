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
  computeCategoryAnalytics,
  computePriorityAnalytics,
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

