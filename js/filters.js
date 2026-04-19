/**
 * TaskFlow — filters.js
 * Task filtering, search and sorting logic.
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
 * Filter tasks by search query.
 * Matches against title, description, and category (case-insensitive).
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
    normalise(t.category).includes(q)
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
 * Apply all active filters and sorting to a task array in a unified single pass.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {{
 *   status?: string,
 *   search?: string,
 *   category?: string,
 *   sortBy?: 'default'|'newest'|'oldest'|'priority'|'dueDate'|'updated',
 *   referenceDate?: Date
 * }} [options]
 * @returns {import('./tasks.js').Task[]}
 */
export function applyFilters(tasks, {
  status = 'all',
  search = '',
  category = 'all',
  sortBy = 'default',
  referenceDate = new Date(),
} = {}) {
  let result = filterByStatus(tasks, status, referenceDate);
  result     = filterByCategory(result, category);
  result     = filterBySearch(result, search);
  result     = sortTasks(result, sortBy);
  return result;
}
