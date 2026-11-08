/**
 * TaskFlow — analytics.js
 * Dedicated productivity analytics calculations: trends, category distributions,
 * date-range filtering, and lightweight accessible SVG visualizations.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { isDateOverdue } from './utils.js';
import { formatCalendarDate, SHORT_MONTH_NAMES } from './calendar.js';

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
 * @param {number|'all'} [daysCount] - Number of days in analytical period for velocity calculation
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

  let divisor = 7;
  if (typeof daysCount === 'number' && Number.isFinite(daysCount) && daysCount > 0) {
    divisor = daysCount;
  } else if (daysCount === 'all') {
    let earliestTime = referenceDate.getTime();
    let hasEarliest = false;
    for (const t of tasks) {
      if (t.createdAt) {
        const time = new Date(t.createdAt).getTime();
        if (!isNaN(time) && time < earliestTime) {
          earliestTime = time;
          hasEarliest = true;
        }
      }
    }
    divisor = hasEarliest
      ? Math.max(1, Math.ceil((referenceDate.getTime() - earliestTime) / (24 * 60 * 60 * 1000)))
      : 1;
  }

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
 * Compute weekly completion and creation trends for the past N calendar weeks.
 * Each week starts on Sunday and ends on Saturday.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {number} [weeksCount] - default 8
 * @param {Date} [referenceDate]
 * @returns {Array<{ label: string, weekStart: string, weekEnd: string, completedCount: number, createdCount: number }>}
 */
export function computeWeeklyCompletionTrends(tasks, weeksCount = 8, referenceDate = new Date()) {
  const points = [];
  const safeList = Array.isArray(tasks) ? tasks : [];

  const refDayOfWeek = referenceDate.getDay();
  const currentWeekSunday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - refDayOfWeek);

  for (let i = weeksCount - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekSunday.getFullYear(), currentWeekSunday.getMonth(), currentWeekSunday.getDate() - (i * 7));
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);

    const startStr = formatCalendarDate(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    const endStr = formatCalendarDate(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());

    const startLabel = `${SHORT_MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()}`;
    const endLabel = weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekEnd.getDate()}`
      : `${SHORT_MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getDate()}`;
    const label = `${startLabel}–${endLabel}`;

    let completedCount = 0;
    let createdCount = 0;

    for (const t of safeList) {
      if ((t.status === 'completed' || t.completed) && t.updatedAt) {
        const uDate = t.updatedAt.slice(0, 10);
        if (uDate >= startStr && uDate <= endStr) {
          completedCount++;
        }
      }
      if (t.createdAt) {
        const cDate = t.createdAt.slice(0, 10);
        if (cDate >= startStr && cDate <= endStr) {
          createdCount++;
        }
      }
    }

    points.push({
      label,
      weekStart: startStr,
      weekEnd: endStr,
      completedCount,
      createdCount,
    });
  }

  return points;
}

/**
 * Compute monthly completion and creation trends for the past N calendar months.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {number} [monthsCount] - default 6
 * @param {Date} [referenceDate]
 * @returns {Array<{ label: string, year: number, month: number, completedCount: number, createdCount: number }>}
 */
export function computeMonthlyCompletionTrends(tasks, monthsCount = 6, referenceDate = new Date()) {
  const points = [];
  const safeList = Array.isArray(tasks) ? tasks : [];

  const curYear = referenceDate.getFullYear();
  const curMonth = referenceDate.getMonth();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(curYear, curMonth - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = `${SHORT_MONTH_NAMES[m]} '${String(y).slice(-2)}`;

    let completedCount = 0;
    let createdCount = 0;

    for (const t of safeList) {
      if ((t.status === 'completed' || t.completed) && t.updatedAt && t.updatedAt.slice(0, 7) === prefix) {
        completedCount++;
      }
      if (t.createdAt && t.createdAt.slice(0, 7) === prefix) {
        createdCount++;
      }
    }

    points.push({
      label,
      year: y,
      month: m,
      completedCount,
      createdCount,
    });
  }

  return points;
}

/**
 * Compute breakdown by category, optionally including standard categories with zero tasks.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {boolean} [includeStandard] - default false for backwards compatibility
 * @returns {Array<{ category: string, total: number, completed: number, pending: number, rate: number, completionRate: number, pendingRate: number }>}
 */
export function computeCategoryAnalytics(tasks, includeStandard = false) {
  const map = new Map();
  const safeList = Array.isArray(tasks) ? tasks : [];

  if (includeStandard) {
    const standardCategories = ['Work', 'Personal', 'Study', 'Health', 'Finance', 'General'];
    for (const cat of standardCategories) {
      map.set(cat, { total: 0, completed: 0, pending: 0 });
    }
  }

  for (const t of safeList) {
    const rawCat = (t.category || 'General').trim();
    const cat = rawCat || 'General';
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
    const pendingRate = counts.total > 0 ? Math.round((counts.pending / counts.total) * 100) : 0;
    results.push({
      category,
      total: counts.total,
      completed: counts.completed,
      pending: counts.pending,
      rate,
      completionRate: rate,
      pendingRate,
    });
  }

  // Active categories first (descending by total), then empty ones alphabetically
  return results.sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

/**
 * Compute breakdown by priority separating total share from pending workload and overdue items.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {Date} [referenceDate]
 * @returns {{
 *   high: { total: number, count: number, completed: number, pending: number, overdue: number, percentage: number, pendingShare: number },
 *   medium: { total: number, count: number, completed: number, pending: number, overdue: number, percentage: number, pendingShare: number },
 *   low: { total: number, count: number, completed: number, pending: number, overdue: number, percentage: number, pendingShare: number }
 * }}
 */
export function computePriorityAnalytics(tasks, referenceDate = new Date()) {
  const result = {
    high:   { total: 0, count: 0, completed: 0, pending: 0, overdue: 0, percentage: 0, pendingShare: 0 },
    medium: { total: 0, count: 0, completed: 0, pending: 0, overdue: 0, percentage: 0, pendingShare: 0 },
    low:    { total: 0, count: 0, completed: 0, pending: 0, overdue: 0, percentage: 0, pendingShare: 0 },
  };

  const safeList = Array.isArray(tasks) ? tasks : [];
  let totalTasks = 0;
  let totalPending = 0;

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
      totalPending++;
      if (t.dueDate && isDateOverdue(t.dueDate, referenceDate)) {
        target.overdue++;
      }
    }
  }

  if (totalTasks > 0) {
    result.high.percentage = Math.round((result.high.total / totalTasks) * 100);
    result.medium.percentage = Math.round((result.medium.total / totalTasks) * 100);
    result.low.percentage = Math.round((result.low.total / totalTasks) * 100);
  }

  if (totalPending > 0) {
    result.high.pendingShare = Math.round((result.high.pending / totalPending) * 100);
    result.medium.pendingShare = Math.round((result.medium.pending / totalPending) * 100);
    result.low.pendingShare = Math.round((result.low.pending / totalPending) * 100);
  }

  return result;
}

export const computePriorityWorkload = computePriorityAnalytics;

/**
 * Classify pending tasks into exactly one of five mutually exclusive workload horizon buckets:
 * 1. overdue: dueDate < today
 * 2. today: dueDate === today
 * 3. thisWeek: today < dueDate <= today + 7 days
 * 4. later: dueDate > today + 7 days
 * 5. unscheduled: !dueDate
 *
 * Completed tasks are strictly excluded.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {Date} [referenceDate]
 * @returns {{
 *   overdue: number,
 *   today: number,
 *   thisWeek: number,
 *   later: number,
 *   unscheduled: number,
 *   totalPending: number
 * }}
 */
export function computeWorkloadTimeline(tasks, referenceDate = new Date()) {
  const result = {
    overdue: 0,
    today: 0,
    thisWeek: 0,
    later: 0,
    unscheduled: 0,
    totalPending: 0,
  };

  const safeList = Array.isArray(tasks) ? tasks : [];
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  const todayStr = formatCalendarDate(refYear, refMonth, refDay);
  const weekCutoffDate = new Date(refYear, refMonth, refDay + 7);
  const weekCutoffStr = formatCalendarDate(weekCutoffDate.getFullYear(), weekCutoffDate.getMonth(), weekCutoffDate.getDate());

  for (const t of safeList) {
    if (t.status === 'completed' || t.completed) continue;

    result.totalPending++;

    if (!t.dueDate) {
      result.unscheduled++;
      continue;
    }

    const dueStr = t.dueDate.slice(0, 10);
    if (dueStr < todayStr) {
      result.overdue++;
    } else if (dueStr === todayStr) {
      result.today++;
    } else if (dueStr <= weekCutoffStr) {
      result.thisWeek++;
    } else {
      result.later++;
    }
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
        text: 'No tasks tracked in this period. Create your first task to unlock productivity analytics.',
      },
    ];
  }

  const overview = computeProductivityOverview(safeList, referenceDate);
  const categories = computeCategoryAnalytics(safeList);
  const trends = computeDailyCompletionTrends(safeList, 7, referenceDate);

  const insights = [];

  // Completion rate insight
  if (overview.completionRate === 100) {
    insights.push({
      type: 'positive',
      text: 'Backlog clear! All tracked tasks in this period are completed.',
    });
  } else if (overview.completionRate >= 80) {
    insights.push({
      type: 'positive',
      text: `Outstanding momentum! You have completed ${overview.completionRate}% of your tasks.`,
    });
  } else if (overview.completionRate >= 50) {
    insights.push({
      type: 'positive',
      text: `Steady progress: ${overview.completionRate}% of your tracked tasks are done.`,
    });
  } else if (overview.total >= 3 && overview.completionRate === 0) {
    insights.push({
      type: 'neutral',
      text: `All ${overview.pending} tasks are pending. Pick one high-priority item to build momentum.`,
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

  // High priority workload insight
  if (overview.highPriorityPending > 0) {
    insights.push({
      type: 'warning',
      text: `${overview.highPriorityPending} high-priority ${overview.highPriorityPending === 1 ? 'task requires' : 'tasks require'} your immediate focus.`,
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
 * Render a lightweight, accessible dual-series SVG Bar Chart representation of completion trends and task creation.
 * Zero external libraries, fully responsive and scalable.
 *
 * @param {Array<{ label: string, completedCount?: number, createdCount?: number }>} data
 * @param {{ width?: number, height?: number, completedColor?: string, createdColor?: string }} [options]
 * @returns {string} Safe SVG markup string
 */
export function generateTrendChartSVG(data, {
  width = 540,
  height = 180,
  completedColor = 'var(--color-primary, #0D9488)',
  createdColor = 'var(--color-text-muted, #94A3B8)',
} = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Productivity Trend Chart"><text x="50%" y="50%" text-anchor="middle" fill="currentColor" opacity="0.6">No trend data available</text></svg>`;
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.completedCount || 0, d.createdCount || 0)), 1);
  const paddingX = 36;
  const paddingBottom = 30;
  const paddingTop = 24;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const slotWidth = chartWidth / data.length;

  const subBarWidth = Math.max(5, Math.min(16, Math.floor((slotWidth - 8) / 2)));
  const barGap = 2;

  let gridMarkup = '';
  let barsMarkup = '';
  let labelsMarkup = '';

  // 50% guideline
  const midY = (paddingTop + chartHeight / 2).toFixed(1);
  gridMarkup += `<line x1="${paddingX}" y1="${midY}" x2="${(width - paddingX).toFixed(1)}" y2="${midY}" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="3 3" />`;
  // Baseline
  const baseY = (paddingTop + chartHeight).toFixed(1);
  gridMarkup += `<line x1="${paddingX}" y1="${baseY}" x2="${(width - paddingX).toFixed(1)}" y2="${baseY}" stroke="currentColor" stroke-opacity="0.18" stroke-width="1" />`;

  data.forEach((item, idx) => {
    const slotX = paddingX + idx * slotWidth;
    const xComp = slotX + (slotWidth - (subBarWidth * 2 + barGap)) / 2;
    const xCreated = xComp + subBarWidth + barGap;

    const compCount = Number.isFinite(item.completedCount) ? item.completedCount : 0;
    const createdCount = Number.isFinite(item.createdCount) ? item.createdCount : 0;

    const compH = (compCount / maxVal) * chartHeight;
    const createdH = (createdCount / maxVal) * chartHeight;

    const compY = paddingTop + (chartHeight - compH);
    const createdY = paddingTop + (chartHeight - createdH);

    const safeLabel = String(item.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Completed bar (Teal)
    barsMarkup += `
      <rect x="${xComp.toFixed(1)}" y="${compY.toFixed(1)}" width="${subBarWidth}" height="${compH.toFixed(1)}" rx="3" fill="${completedColor}" opacity="0.95">
        <title>${safeLabel} — Completed: ${compCount}, Created: ${createdCount}</title>
      </rect>
    `;

    // Created bar (Muted)
    barsMarkup += `
      <rect x="${xCreated.toFixed(1)}" y="${createdY.toFixed(1)}" width="${subBarWidth}" height="${createdH.toFixed(1)}" rx="3" fill="${createdColor}" opacity="0.6">
        <title>${safeLabel} — Completed: ${compCount}, Created: ${createdCount}</title>
      </rect>
    `;

    if (slotWidth >= 28 && compCount > 0) {
      barsMarkup += `<text x="${(xComp + subBarWidth / 2).toFixed(1)}" y="${(compY - 4).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">${compCount}</text>`;
    }

    labelsMarkup += `
      <text x="${(slotX + slotWidth / 2).toFixed(1)}" y="${(height - 8).toFixed(1)}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">${safeLabel}</text>
    `;
  });

  return `
    <svg class="analytics-chart-svg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Productivity Trend Chart">
      <desc>Dual series chart displaying task activity: completed tasks and created tasks.</desc>
      ${gridMarkup}
      ${barsMarkup}
      ${labelsMarkup}
    </svg>
  `.trim();
}
