/**
 * TaskFlow — filters.js
 * Task filtering and search logic.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { normalise } from './utils.js';

/**
 * Filter tasks by status.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {'all'|'pending'|'completed'} filter
 * @returns {import('./tasks.js').Task[]}
 */
export function filterByStatus(tasks, filter) {
  if (filter === 'pending')   return tasks.filter(t => t.status === 'pending');
  if (filter === 'completed') return tasks.filter(t => t.status === 'completed');
  return tasks; // 'all'
}

/**
 * Filter tasks by a search query string.
 * Matches against title and description (case-insensitive).
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {string} query
 * @returns {import('./tasks.js').Task[]}
 */
export function filterBySearch(tasks, query) {
  const q = normalise(query);
  if (!q) return tasks;
  return tasks.filter(t =>
    normalise(t.title).includes(q) ||
    normalise(t.description).includes(q)
  );
}

/**
 * Apply all active filters to a task array in a single pass.
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @param {{ status: 'all'|'pending'|'completed', search: string }} options
 * @returns {import('./tasks.js').Task[]}
 */
export function applyFilters(tasks, { status = 'all', search = '' } = {}) {
  let result = filterByStatus(tasks, status);
  result     = filterBySearch(result, search);
  return result;
}

/**
 * Sort tasks: high-priority pending tasks first, then by creation date (newest first).
 *
 * @param {import('./tasks.js').Task[]} tasks
 * @returns {import('./tasks.js').Task[]}
 */
export function sortTasks(tasks) {
  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    // Completed tasks always go last
    if (a.status !== b.status) {
      return a.status === 'completed' ? 1 : -1;
    }
    // Within same status, sort by priority then by newest creation date
    const pDiff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    if (pDiff !== 0) return pDiff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}
