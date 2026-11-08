/**
 * TaskFlow — filters.js
 * Task filtering, search, grouping, and sorting logic.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { normalise } from './utils.js';
import { isTaskDueToday, isTaskUpcoming, isTaskOverdue } from './tasks.js';

export const SORT_OPTIONS = Object.freeze([
  'default',
  'newest',
  'oldest',
  'priority',
  'dueDate',
  'updated',
]);

export const GROUP_BY_OPTIONS = Object.freeze([
  'none',
  'priority',
  'category',
  'dueDate',
  'status',
]);

/**
 * Filter tasks by status / view type.
 * Supports: 'all', 'pending', 'completed', 'today', 'upcoming', 'overdue', 'high'.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {string} filter
 * @param {Date} [referenceDate]
 * @returns {import('./tasks.js').Task[]}
 */
export function filterByStatus(tasks, filter, referenceDate = new Date()) {
  if (!Array.isArray(tasks)) return [];

  switch (filter) {
    case 'pending':
      return tasks.filter(t => t.status === 'pending' || t.completed === false);

    case 'completed':
      return tasks.filter(t => t.status === 'completed' || t.completed === true);

    case 'today':
      return tasks.filter(t => isTaskDueToday(t, referenceDate));

    case 'upcoming':
      return tasks.filter(t => isTaskUpcoming(t, referenceDate));

    case 'overdue':
      return tasks.filter(t => isTaskOverdue(t, referenceDate));

    case 'high':
      return tasks.filter(t => t.priority === 'high' && (t.status === 'pending' || !t.completed));

    case 'all':
    default:
      return tasks;
  }
}

/**
 * Filter tasks by category.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {string} category
 * @returns {import('./tasks.js').Task[]}
 */
export function filterByCategory(tasks, category) {
  if (!Array.isArray(tasks)) return [];
  if (!category || category === 'all') return tasks;
  const target = normalise(category);
  return tasks.filter(t => normalise(t.category) === target);
}

/**
 * Filter tasks by tag.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {string} tag
 * @returns {import('./tasks.js').Task[]}
 */
export function filterByTag(tasks, tag) {
  if (!Array.isArray(tasks)) return [];
  if (!tag || tag === 'all') return tasks;
  const target = normalise(tag.replace(/^#/, ''));
  if (!target) return tasks;

  return tasks.filter(t =>
    Array.isArray(t.tags) && t.tags.some(tTag => normalise(tTag) === target)
  );
}

/**
 * Filter tasks by search query.
 * Matches against title, description, category, tags, notes, and subtasks (case-insensitive).
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {string} query
 * @returns {import('./tasks.js').Task[]}
 */
export function filterBySearch(tasks, query) {
  if (!Array.isArray(tasks)) return [];
  const q = normalise(query);
  if (!q) return tasks;

  return tasks.filter(t =>
    normalise(t.title).includes(q) ||
    normalise(t.description).includes(q) ||
    normalise(t.category).includes(q) ||
    (Array.isArray(t.tags) && t.tags.some(tag => normalise(tag).includes(q))) ||
    (typeof t.notes === 'string' && normalise(t.notes).includes(q)) ||
    (Array.isArray(t.subtasks) && t.subtasks.some(st => normalise(st.title).includes(q)))
  );
}

/**
 * Sort tasks according to a selected criteria.
 * Supports:
 * - 'default': completed last, priority (high->med->low), newest createdAt first.
 * - 'newest': newest createdAt first.
 * - 'oldest': oldest createdAt first.
 * - 'priority': priority (high->med->low), then newest createdAt.
 * - 'dueDate': earliest dueDate first, tasks with due dates before tasks without.
 * - 'updated': recently updated first (updatedAt desc).
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {'default'|'newest'|'oldest'|'priority'|'dueDate'|'updated'} [sortBy='default']
 * @returns {import('./tasks.js').Task[]}
 */
export function sortTasks(tasks, sortBy = 'default') {
  if (!Array.isArray(tasks)) return [];
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  return [...tasks].sort((a, b) => {
    const aCompleted = a.status === 'completed' || a.completed === true;
    const bCompleted = b.status === 'completed' || b.completed === true;

    // In 'default' or 'priority' mode, completed tasks always settle to the bottom
    if (sortBy === 'default' || sortBy === 'priority') {
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }
    }

    switch (sortBy) {
      case 'newest': {
        const dDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return isNaN(dDiff) ? 0 : dDiff;
      }

      case 'oldest': {
        const dDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return isNaN(dDiff) ? 0 : dDiff;
      }

      case 'updated': {
        const aUp = a.updatedAt || a.createdAt;
        const bUp = b.updatedAt || b.createdAt;
        const dDiff = new Date(bUp).getTime() - new Date(aUp).getTime();
        return isNaN(dDiff) ? 0 : dDiff;
      }

      case 'dueDate': {
        // Uncompleted tasks first
        if (aCompleted !== bCompleted) {
          return aCompleted ? 1 : -1;
        }
        // Tasks with due dates before tasks without
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        if (!a.dueDate && !b.dueDate) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        const dueDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (dueDiff !== 0 && !isNaN(dueDiff)) return dueDiff;
        return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      }

      case 'priority': {
        const pDiff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        if (pDiff !== 0) return pDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      case 'default':
      default: {
        const pDiff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        if (pDiff !== 0) return pDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    }
  });
}

/**
 * Group an array of tasks by a given dimension.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {'none'|'priority'|'category'|'dueDate'|'status'} [groupBy='none']
 * @param {Date} [referenceDate]
 * @returns {Array<{ key: string, label: string, count: number, tasks: import('./tasks.js').Task[] }>}
 */
export function groupTasks(tasks, groupBy = 'none', referenceDate = new Date()) {
  if (!Array.isArray(tasks)) return [];

  switch (groupBy) {
    case 'priority': {
      const high = tasks.filter(t => t.priority === 'high');
      const med  = tasks.filter(t => t.priority === 'medium');
      const low  = tasks.filter(t => t.priority === 'low');
      return [
        { key: 'high', label: 'High Priority', count: high.length, tasks: high },
        { key: 'medium', label: 'Medium Priority', count: med.length, tasks: med },
        { key: 'low', label: 'Low Priority', count: low.length, tasks: low },
      ];
    }

    case 'category': {
      const map = new Map();
      for (const t of tasks) {
        const cat = t.category || 'General';
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push(t);
      }
      return Array.from(map.entries())
        .map(([cat, list]) => ({ key: cat, label: cat, count: list.length, tasks: list }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    case 'dueDate': {
      const overdue = [];
      const today = [];
      const upcoming = [];
      const noDate = [];

      for (const t of tasks) {
        if (!t.dueDate) {
          noDate.push(t);
        } else if (isTaskOverdue(t, referenceDate)) {
          overdue.push(t);
        } else if (isTaskDueToday(t, referenceDate)) {
          today.push(t);
        } else {
          upcoming.push(t);
        }
      }

      return [
        { key: 'overdue', label: 'Overdue', count: overdue.length, tasks: overdue },
        { key: 'today', label: 'Due Today', count: today.length, tasks: today },
        { key: 'upcoming', label: 'Upcoming', count: upcoming.length, tasks: upcoming },
        { key: 'nodate', label: 'No Due Date', count: noDate.length, tasks: noDate },
      ];
    }

    case 'status': {
      const pending = tasks.filter(t => t.status === 'pending' && !t.completed);
      const completed = tasks.filter(t => t.status === 'completed' || t.completed);
      return [
        { key: 'pending', label: 'Pending', count: pending.length, tasks: pending },
        { key: 'completed', label: 'Completed', count: completed.length, tasks: completed },
      ];
    }

    case 'none':
    default:
      return [{ key: 'all', label: 'All Tasks', count: tasks.length, tasks }];
  }
}

/**
 * Apply all active filters and sorting to a task array in a unified single pass.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {{
 *   status?: string,
 *   search?: string,
 *   category?: string,
 *   tag?: string,
 *   sortBy?: 'default'|'newest'|'oldest'|'priority'|'dueDate'|'updated',
 *   referenceDate?: Date
 * }} [options]
 * @returns {import('./tasks.js').Task[]}
 */
export function applyFilters(tasks, {
  status = 'all',
  search = '',
  category = 'all',
  tag = 'all',
  sortBy = 'default',
  referenceDate = new Date(),
} = {}) {
  let result = filterByStatus(tasks, status, referenceDate);
  result     = filterByCategory(result, category);
  result     = filterByTag(result, tag);
  result     = filterBySearch(result, search);
  result     = sortTasks(result, sortBy);
  return result;
}

/**
 * Compute counts for standard categories and total ('all').
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @returns {{ all: number, Work: number, Personal: number, Study: number, Health: number, Finance: number, General: number }}
 */
export function countTasksByCategory(tasks = []) {
  const safeList = Array.isArray(tasks) ? tasks : [];
  const counts = {
    all: safeList.length,
    Work: 0,
    Personal: 0,
    Study: 0,
    Health: 0,
    Finance: 0,
    General: 0,
  };

  for (const t of safeList) {
    const rawCat = (t && t.category ? String(t.category) : 'General').trim().toLowerCase();
    const matchedKey = Object.keys(counts).find(
      (k) => k !== 'all' && k.toLowerCase() === rawCat
    );
    if (matchedKey) {
      counts[matchedKey]++;
    } else {
      counts.General++;
    }
  }

  return counts;
}

