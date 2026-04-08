/**
 * TaskFlow — tasks.js
 * Task domain model — create, update, delete, validate.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 *
 * @typedef {'low'|'medium'|'high'} Priority
 * @typedef {'pending'|'completed'} Status
 *
 * @typedef {Object} Task
 * @property {string}   id          - Unique identifier (UUID or fallback).
 * @property {string}   title       - Task title (1–200 chars, required).
 * @property {string}   description - Optional description (0–1000 chars).
 * @property {Priority} priority    - 'low' | 'medium' | 'high'.
 * @property {Status}   status      - 'pending' | 'completed'.
 * @property {string}   createdAt   - ISO 8601 creation timestamp.
 * @property {string}   updatedAt   - ISO 8601 last-update timestamp.
 */

'use strict';

import { generateId, nowISO, isNonEmptyString } from './utils.js';

export const PRIORITIES = /** @type {const} */ (['low', 'medium', 'high']);
export const STATUSES   = /** @type {const} */ (['pending', 'completed']);

const TITLE_MAX_LENGTH       = 200;
const DESCRIPTION_MAX_LENGTH = 1000;

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate task input fields.
 *
 * @param {{ title?: string, description?: string, priority?: string }} input
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validateTaskInput(input) {
  const errors = {};

  const title = (input.title || '').trim();
  if (!isNonEmptyString(title)) {
    errors.title = 'Task title is required.';
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const description = (input.description || '').trim();
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }

  // Priority is validated only when explicitly supplied and non-empty.
  // An unrecognised priority is silently coerced to 'medium' at creation time,
  // so validation only blocks explicit bad values coming from the edit form.
  const priority = input.priority;
  if (priority !== undefined && priority !== '' && !PRIORITIES.includes(priority)) {
    errors.priority = 'Priority must be low, medium or high.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new Task object.
 *
 * @param {{ title: string, description?: string, priority?: Priority }} input
 * @returns {Task}
 * @throws {Error} If input is invalid.
 */
export function createTask(input) {
  const { valid, errors } = validateTaskInput(input);
  if (!valid) {
    const firstError = Object.values(errors)[0];
    throw new Error(firstError);
  }

  const now = nowISO();
  return {
    id:          generateId(),
    title:       input.title.trim(),
    description: (input.description || '').trim(),
    priority:    PRIORITIES.includes(input.priority) ? input.priority : 'medium',
    status:      'pending',
    createdAt:   now,
    updatedAt:   now,
  };
}

/**
 * Apply updates to an existing task, returning a new task object (immutable).
 *
 * @param {Task} task
 * @param {{ title?: string, description?: string, priority?: Priority }} updates
 * @returns {Task}
 * @throws {Error} If updates are invalid.
 */
export function updateTask(task, updates) {
  const merged = {
    title:       updates.title       !== undefined ? updates.title       : task.title,
    description: updates.description !== undefined ? updates.description : task.description,
    priority:    updates.priority    !== undefined ? updates.priority    : task.priority,
  };

  const { valid, errors } = validateTaskInput(merged);
  if (!valid) {
    const firstError = Object.values(errors)[0];
    throw new Error(firstError);
  }

  return {
    ...task,
    title:       merged.title.trim(),
    description: merged.description.trim(),
    priority:    merged.priority,
    updatedAt:   nowISO(),
  };
}

/**
 * Toggle the status of a task between 'pending' and 'completed'.
 *
 * @param {Task} task
 * @returns {Task}
 */
export function toggleTaskStatus(task) {
  return {
    ...task,
    status:    task.status === 'completed' ? 'pending' : 'completed',
    updatedAt: nowISO(),
  };
}

// ─── Collection helpers ───────────────────────────────────────────────────────

/**
 * Add a task to a task array (returns new array, does not mutate).
 *
 * @param {Task[]} tasks
 * @param {Task}   task
 * @returns {Task[]}
 */
export function addTask(tasks, task) {
  return [...tasks, task];
}

/**
 * Replace a task by ID in a task array (returns new array).
 *
 * @param {Task[]} tasks
 * @param {Task}   updated
 * @returns {Task[]}
 */
export function replaceTask(tasks, updated) {
  return tasks.map(t => (t.id === updated.id ? updated : t));
}

/**
 * Remove a task by ID from a task array (returns new array).
 *
 * @param {Task[]} tasks
 * @param {string} id
 * @returns {Task[]}
 */
export function deleteTask(tasks, id) {
  return tasks.filter(t => t.id !== id);
}

/**
 * Find a task by ID. Returns undefined if not found.
 *
 * @param {Task[]} tasks
 * @param {string} id
 * @returns {Task|undefined}
 */
export function findTaskById(tasks, id) {
  return tasks.find(t => t.id === id);
}

// ─── Statistics ───────────────────────────────────────────────────────────────

/**
 * Compute dashboard statistics from the task array.
 *
 * @param {Task[]} tasks
 * @returns {{ total: number, pending: number, completed: number, highPriority: number, completionRate: number }}
 */
export function computeStats(tasks) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending   = total - completed;
  const highPriority = tasks.filter(t => t.priority === 'high' && t.status === 'pending').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, pending, completed, highPriority, completionRate };
}
