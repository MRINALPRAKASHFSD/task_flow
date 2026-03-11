/**
 * TaskFlow — analytics.js
 * Dedicated productivity analytics calculations: trends, category distributions,
 * date-range filtering, and lightweight accessible SVG visualizations.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { parseLocalDate, isDateOverdue } from './utils.js';
import { formatCalendarDate } from './calendar.js';

export const TIME_FRAMES = Object.freeze(['7d', '30d', '90d', 'all']);

/**
 * Filter tasks by date range based on their creation or update timestamps.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {'7d'|'30d'|'90d'|'all'} timeFrame
 * @param {Date} [referenceDate]
 * @returns {import('./tasks.js').Task[]}
 */
export function filterTasksByTimeFrame(tasks, timeFrame = 'all', referenceDate = new Date()) {
  if (!Array.isArray(tasks)) return [];
  if (timeFrame === 'all') return [...tasks];

  const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
  const days = daysMap[timeFrame] || 30;

  const cutoff = new Date(referenceDate.getTime() - days * 24 * 60 * 60 * 1000);

  return tasks.filter((t) => {
    const timestamp = t.updatedAt || t.createdAt;
    if (!timestamp) return false;
    const d = new Date(timestamp);
    return !isNaN(d.getTime()) && d.getTime() >= cutoff.getTime();
  });
}

/**
 * Compute high-level productivity overview metrics.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {Date} [referenceDate]
 * @param {number} [daysCount] - Number of days in analytical period for velocity calculation
 * @returns {{
 *   total: number,
 *   completed: number,
 *   pending: number,
 *   overdue: number,
 *   completionRate: number,
 *   highPriorityPending: number,
 *   averagePerDay: number
 * }}
 */
export function computeProductivityOverview(tasks, referenceDate = new Date(), daysCount = 7) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      completionRate: 0,
      highPriorityPending: 0,
      averagePerDay: 0,
    };
  }

  let completed = 0;
  let pending = 0;
  let overdue = 0;
  let highPriorityPending = 0;

  for (const t of tasks) {
    if (t.status === 'completed' || t.completed) {
      completed++;
    } else {
      pending++;
      if (t.priority === 'high') highPriorityPending++;
      if (t.dueDate && isDateOverdue(t.dueDate, referenceDate)) {
        overdue++;
      }
    }
  }

  const total = completed + pending;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const divisor = Math.max(1, Number.isFinite(daysCount) && daysCount > 0 ? daysCount : 7);
  const averagePerDay = Number((completed / divisor).toFixed(1));

  return {
    total,
    completed,
    pending,
    overdue,
    completionRate,
    highPriorityPending,
    averagePerDay,
  };
}

/**
 * Compute daily completion trend points for the past N days.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {number} [daysCount] - default 7
 * @param {Date} [referenceDate]
 * @returns {Array<{ label: string, dateString: string, completedCount: number, createdCount: number }>}
 */
export function computeDailyCompletionTrends(tasks, daysCount = 7, referenceDate = new Date()) {
  const points = [];
  const safeList = Array.isArray(tasks) ? tasks : [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - i);
    const dateString = formatCalendarDate(d.getFullYear(), d.getMonth(), d.getDate());

    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

    let completedCount = 0;
    let createdCount = 0;

    for (const t of safeList) {
      if ((t.status === 'completed' || t.completed) && t.updatedAt && t.updatedAt.slice(0, 10) === dateString) {
        completedCount++;
      }
      if (t.createdAt && t.createdAt.slice(0, 10) === dateString) {
        createdCount++;
      }
    }

    points.push({
      label: dayName,
      dateString,
      completedCount,
      createdCount,
    });
  }

  return points;
}

/**
 * Compute breakdown by category.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @returns {Array<{ category: string, total: number, completed: number, pending: number, rate: number }>}
 */
export function computeCategoryAnalytics(tasks) {
  const map = new Map();
  const safeList = Array.isArray(tasks) ? tasks : [];

  for (const t of safeList) {
    const cat = (t.category || 'General').trim();
    if (!map.has(cat)) {
      map.set(cat, { total: 0, completed: 0, pending: 0 });
    }
    const rec = map.get(cat);
    rec.total++;
    if (t.status === 'completed' || t.completed) {
      rec.completed++;
    } else {
      rec.pending++;
    }
  }

  const results = [];
  for (const [category, counts] of map.entries()) {
    const rate = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
    results.push({
      category,
      total: counts.total,
      completed: counts.completed,
      pending: counts.pending,
      rate,
      completionRate: rate,
    });
  }

  // Sort by total descending
  return results.sort((a, b) => b.total - a.total);
}

/**
 * Compute breakdown by priority.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @returns {{
 *   high: { total: number, count: number, completed: number, pending: number, percentage: number },
 *   medium: { total: number, count: number, completed: number, pending: number, percentage: number },
 *   low: { total: number, count: number, completed: number, pending: number, percentage: number }
 * }}
 */
export function computePriorityAnalytics(tasks) {
  const result = {
    high: { total: 0, count: 0, completed: 0, pending: 0, percentage: 0 },
    medium: { total: 0, count: 0, completed: 0, pending: 0, percentage: 0 },
    low: { total: 0, count: 0, completed: 0, pending: 0, percentage: 0 },
  };

  const safeList = Array.isArray(tasks) ? tasks : [];
  let totalTasks = 0;

  for (const t of safeList) {
    const prio = (t.priority || 'medium').toLowerCase();
    const target = result[prio] || result.medium;
    target.total++;
    target.count++;
    totalTasks++;
    if (t.status === 'completed' || t.completed) {
      target.completed++;
    } else {
      target.pending++;
    }
  }

  if (totalTasks > 0) {
    result.high.percentage = Math.round((result.high.total / totalTasks) * 100);
    result.medium.percentage = Math.round((result.medium.total / totalTasks) * 100);
    result.low.percentage = Math.round((result.low.total / totalTasks) * 100);
  }

  return result;
}

/**
 * Extract qualitative productivity insights from real data.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {Date} [referenceDate]
 * @returns {Array<{ type: 'positive'|'warning'|'neutral', text: string }>}
 */
export function computeProductivityInsights(tasks, referenceDate = new Date()) {
  const safeList = Array.isArray(tasks) ? tasks : [];
  if (safeList.length === 0) {
    return [
      {
        type: 'neutral',
        text: 'No tasks tracked yet. Create your first task to unlock productivity analytics.',
      },
    ];
  }

  const overview = computeProductivityOverview(safeList, referenceDate);
  const categories = computeCategoryAnalytics(safeList);
  const trends = computeDailyCompletionTrends(safeList, 7, referenceDate);

  const insights = [];

  // Completion rate insight
  if (overview.completionRate >= 80) {
    insights.push({
      type: 'positive',
      text: `Outstanding momentum! You have completed ${overview.completionRate}% of your tasks.`,
    });
  } else if (overview.completionRate >= 50) {
    insights.push({
      type: 'positive',
      text: `Steady progress. Over half (${overview.completionRate}%) of your tracked tasks are done.`,
    });
  } else if (overview.total >= 5 && overview.completionRate < 30) {
    insights.push({
      type: 'warning',
      text: `Completion rate is at ${overview.completionRate}%. Consider breaking large tasks into subtasks.`,
    });
  }

  // Overdue insight
  if (overview.overdue > 0) {
    insights.push({
      type: 'warning',
      text: `You have ${overview.overdue} overdue ${overview.overdue === 1 ? 'task' : 'tasks'} requiring attention.`,
    });
  } else if (overview.pending > 0) {
    insights.push({
      type: 'positive',
      text: 'All pending tasks are on schedule with zero overdue items.',
    });
  }

  // Top category insight
  if (categories.length > 0 && categories[0].total > 0) {
    const top = categories[0];
    insights.push({
      type: 'neutral',
      text: `Most active category is ${top.category} with ${top.total} tasks (${top.completed} completed).`,
    });
  }

  // Best day in the last 7 days
  const bestDay = [...trends].sort((a, b) => b.completedCount - a.completedCount)[0];
  if (bestDay && bestDay.completedCount > 0) {
    insights.push({
      type: 'positive',
      text: `Peak productivity this week was on ${bestDay.label} (${bestDay.completedCount} tasks completed).`,
    });
  }

  return insights;
}

/**
 * Render a lightweight, accessible SVG Bar Chart representation of completion trends.
 * Zero external libraries, fully responsive and scalable.
 *
 * @param {Array<{ label: string, completedCount: number }>} data
 * @param {{ width?: number, height?: number, barColor?: string }} [options]
 * @returns {string} Safe SVG markup string
 */
export function generateTrendChartSVG(data, { width = 480, height = 180, barColor = 'var(--color-primary, #6366f1)' } = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="No trend data available"><text x="50%" y="50%" text-anchor="middle" fill="currentColor">No data available</text></svg>`;
  }

  const maxVal = Math.max(...data.map((d) => d.completedCount), 1);
  const paddingX = 40;
  const paddingBottom = 30;
  const paddingTop = 20;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const barWidth = Math.max(12, Math.floor(chartWidth / data.length) - 16);
  const slotWidth = chartWidth / data.length;

  let barsMarkup = '';
  let labelsMarkup = '';

  data.forEach((item, idx) => {
    const x = paddingX + idx * slotWidth + (slotWidth - barWidth) / 2;
    const barH = (item.completedCount / maxVal) * chartHeight;
    const y = paddingTop + (chartHeight - barH);
    const safeLabel = String(item.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeCount = Number.isFinite(item.completedCount) ? item.completedCount : 0;

    barsMarkup += `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth}" height="${barH.toFixed(1)}" rx="4" fill="${barColor}" opacity="0.9">
        <title>${safeLabel}: ${safeCount} completed</title>
      </rect>
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">${safeCount}</text>
    `;

    labelsMarkup += `
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${(height - 8).toFixed(1)}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.75">${safeLabel}</text>
    `;
  });

  return `
    <svg class="analytics-chart-svg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Productivity Trend Chart">
      <line x1="${paddingX}" y1="${(paddingTop + chartHeight).toFixed(1)}" x2="${(width - paddingX).toFixed(1)}" y2="${(paddingTop + chartHeight).toFixed(1)}" stroke="currentColor" stroke-opacity="0.15" stroke-width="1" />
      ${barsMarkup}
      ${labelsMarkup}
    </svg>
  `.trim();
}
