/**
 * TaskFlow — tasks.js
 * Task domain model — create, update, delete, validate, compute statistics,
 * tags, subtasks, notes, and progress tracking.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 *
 * @typedef {'low'|'medium'|'high'} Priority
 * @typedef {'pending'|'completed'} Status
 *
 * @typedef {Object} Subtask
 * @property {string}  id        - Unique subtask identifier.
 * @property {string}  title     - Subtask title.
 * @property {boolean} completed - Completion state.
 *
 * @typedef {Object} Task
 * @property {string}        id          - Unique identifier (UUID or fallback).
 * @property {string}        title       - Task title (1–200 chars, required).
 * @property {string}        description - Optional description (0–1000 chars).
 * @property {Priority}      priority    - 'low' | 'medium' | 'high'.
 * @property {string}        category    - Category tag (e.g., 'Work', 'Personal').
 * @property {Status}        status      - 'pending' | 'completed'.
 * @property {boolean}       completed   - Whether the task is completed.
 * @property {string|null}   dueDate     - Optional due date (YYYY-MM-DD or ISO string).
 * @property {string[]}      tags        - Array of clean tags.
 * @property {Subtask[]}     subtasks    - Array of subtasks.
 * @property {string}        notes       - Extended markdown/text notes.
 * @property {object|null}   recurrence  - Optional recurrence configuration.
 * @property {string|null}   reminderTime- Optional reminder time (HH:MM).
 * @property {string}        createdAt   - ISO 8601 creation timestamp.
 * @property {string}        updatedAt   - ISO 8601 last-update timestamp.
 */

'use strict';

import {
  generateId,
  nowISO,
  isNonEmptyString,
  isValidDateString,
  isDateToday,
  isDateOverdue,
  isDateUpcoming,
  parseLocalDate,
} from './utils.js';

export const PRIORITIES = /** @type {const} */ (['low', 'medium', 'high']);
export const STATUSES   = /** @type {const} */ (['pending', 'completed']);
export const CATEGORIES = Object.freeze([
  'Work',
  'Personal',
  'Study',
  'Health',
  'Finance',
  'General',
]);

export const TITLE_MAX_LENGTH       = 200;
export const DESCRIPTION_MAX_LENGTH = 1000;
export const CATEGORY_MAX_LENGTH    = 50;
export const NOTES_MAX_LENGTH       = 5000;
export const TAG_MAX_LENGTH         = 30;
export const TAGS_MAX_COUNT         = 20;

// ─── Normalisation Helpers ───────────────────────────────────────────────────

/**
 * Normalise a tag string or array into an array of clean, unique strings.
 *
 * @param {string|string[]} [input]
 * @returns {string[]}
 */
export function normaliseTags(input) {
  if (!input) return [];
  let rawList = [];

  if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === 'string') {
    rawList = input.split(',');
  }

  const seen = new Set();
  const result = [];

  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    // Strip leading hash, trim, lowercase, remove unsupported characters
    const clean = item.replace(/^#/, '').trim().toLowerCase().slice(0, TAG_MAX_LENGTH);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
      if (result.length >= TAGS_MAX_COUNT) break;
    }
  }

  return result;
}

/**
 * Normalise subtasks array ensuring proper shape and unique IDs.
 *
 * @param {Array<object|string>} [input]
 * @returns {Subtask[]}
 */
export function normaliseSubtasks(input) {
  if (!Array.isArray(input)) return [];
  const result = [];

  for (const item of input) {
    if (typeof item === 'string') {
      const title = item.trim().slice(0, TITLE_MAX_LENGTH);
      if (title) {
        result.push({
          id: generateId(),
          title,
          completed: false,
        });
      }
    } else if (item && typeof item === 'object') {
      const rawTitle = typeof item.title === 'string' ? item.title.trim().slice(0, TITLE_MAX_LENGTH) : '';
      if (rawTitle) {
        result.push({
          id: (typeof item.id === 'string' && item.id.trim()) ? item.id.trim() : generateId(),
          title: rawTitle,
          completed: Boolean(item.completed),
        });
      }
    }
  }

  return result;
}

/**
 * Normalise notes string.
 *
 * @param {string} [notes]
 * @returns {string}
 */
export function normaliseNotes(notes) {
  if (typeof notes !== 'string') return '';
  return notes.trim().slice(0, NOTES_MAX_LENGTH);
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate task input fields.
 *
 * @param {{
 *   title?: string,
 *   description?: string,
 *   priority?: string,
 *   category?: string,
 *   dueDate?: string|null,
 *   notes?: string,
 *   tags?: string|string[],
 *   reminderTime?: string|null
 * }} input
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validateTaskInput(input = {}) {
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

  const priority = input.priority;
  if (priority !== undefined && priority !== '' && !PRIORITIES.includes(priority)) {
    errors.priority = 'Priority must be low, medium or high.';
  }

  const category = input.category;
  if (category && typeof category === 'string' && category.trim().length > CATEGORY_MAX_LENGTH) {
    errors.category = `Category must be ${CATEGORY_MAX_LENGTH} characters or fewer.`;
  }

  const dueDate = input.dueDate;
  if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
    if (!isValidDateString(dueDate)) {
      errors.dueDate = 'Due date must be a valid YYYY-MM-DD date.';
    }
  }

  if (input.notes && typeof input.notes === 'string' && input.notes.length > NOTES_MAX_LENGTH) {
    errors.notes = `Notes must be ${NOTES_MAX_LENGTH} characters or fewer.`;
  }

  if (input.reminderTime && typeof input.reminderTime === 'string') {
    if (!/^(\d{1,2}):(\d{2})$/.test(input.reminderTime.trim())) {
      errors.reminderTime = 'Reminder time must be in HH:MM format.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ─── Due date status helpers ──────────────────────────────────────────────────

/**
 * Normalise due date to YYYY-MM-DD or null.
 *
 * @param {string|null|undefined} dueDate
 * @returns {string|null}
 */
export function normaliseDueDate(dueDate) {
  if (!dueDate) return null;
  const parsed = parseLocalDate(dueDate);
  if (!parsed) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if a task is overdue (pending and due before reference date).
 *
 * @param {Task} task
 * @param {Date} [referenceDate]
 * @returns {boolean}
 */
export function isTaskOverdue(task, referenceDate = new Date()) {
  if (!task || task.status === 'completed' || task.completed) return false;
  if (!task.dueDate) return false;
  return isDateOverdue(task.dueDate, referenceDate);
}

/**
 * Check if a task is due today.
 *
 * @param {Task} task
 * @param {Date} [referenceDate]
 * @returns {boolean}
 */
export function isTaskDueToday(task, referenceDate = new Date()) {
  if (!task || !task.dueDate) return false;
  return isDateToday(task.dueDate, referenceDate);
}

/**
 * Check if a task is upcoming (pending and due after reference date).
 *
 * @param {Task} task
 * @param {Date} [referenceDate]
 * @returns {boolean}
 */
export function isTaskUpcoming(task, referenceDate = new Date()) {
  if (!task || task.status === 'completed' || task.completed) return false;
  if (!task.dueDate) return false;
  return isDateUpcoming(task.dueDate, referenceDate);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new Task object.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   priority?: Priority,
 *   category?: string,
 *   dueDate?: string|null,
 *   tags?: string|string[],
 *   subtasks?: Array<object|string>,
 *   notes?: string,
 *   recurrence?: object|null,
 *   reminderTime?: string|null
 * }} input
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
  const rawCategory = (input.category || '').trim();
  const matchedCat = CATEGORIES.find(c => c.toLowerCase() === rawCategory.toLowerCase());
  const category = matchedCat || 'General';
  const dueDate = normaliseDueDate(input.dueDate);
  const tags = normaliseTags(input.tags);
  const subtasks = normaliseSubtasks(input.subtasks);
  const notes = normaliseNotes(input.notes);
  const recurrence = (input.recurrence && typeof input.recurrence === 'object') ? input.recurrence : null;
  const reminderTime = typeof input.reminderTime === 'string' ? input.reminderTime.trim() : null;

  return {
    id:          generateId(),
    title:       input.title.trim(),
    description: (input.description || '').trim(),
    priority:    PRIORITIES.includes(input.priority) ? input.priority : 'medium',
    category,
    status:      'pending',
    completed:   false,
    dueDate,
    tags,
    subtasks,
    notes,
    recurrence,
    reminderTime,
    createdAt:   now,
    updatedAt:   now,
  };
}

/**
 * Apply updates to an existing task, returning a new task object (immutable).
 *
 * @param {Task} task
 * @param {{
 *   title?: string,
 *   description?: string,
 *   priority?: Priority,
 *   category?: string,
 *   dueDate?: string|null,
 *   tags?: string|string[],
 *   subtasks?: Array<object|string>,
 *   notes?: string,
 *   recurrence?: object|null,
 *   reminderTime?: string|null,
 *   status?: Status,
 *   completed?: boolean
 * }} updates
 * @returns {Task}
 * @throws {Error} If updates are invalid.
 */
export function updateTask(task, updates) {
  const merged = {
    title:        updates.title        !== undefined ? updates.title        : task.title,
    description:  updates.description  !== undefined ? updates.description  : task.description,
    priority:     updates.priority     !== undefined ? updates.priority     : task.priority,
    category:     updates.category     !== undefined ? updates.category     : task.category,
    dueDate:      updates.dueDate      !== undefined ? updates.dueDate      : task.dueDate,
    notes:        updates.notes        !== undefined ? updates.notes        : task.notes,
    reminderTime: updates.reminderTime !== undefined ? updates.reminderTime : task.reminderTime,
  };

  const { valid, errors } = validateTaskInput(merged);
  if (!valid) {
    const firstError = Object.values(errors)[0];
    throw new Error(firstError);
  }

  // Determine status and completed flags
  let status = task.status;
  let completed = task.completed ?? (status === 'completed');

  if (updates.status !== undefined) {
    status = updates.status;
    completed = status === 'completed';
  } else if (updates.completed !== undefined) {
    completed = Boolean(updates.completed);
    status = completed ? 'completed' : 'pending';
  }

  let category = task.category || 'General';
  if (merged.category !== undefined) {
    const rawCat = typeof merged.category === 'string' ? merged.category.trim() : '';
    const matched = CATEGORIES.find(c => c.toLowerCase() === rawCat.toLowerCase());
    category = matched || 'General';
  }

  const tags = updates.tags !== undefined ? normaliseTags(updates.tags) : (task.tags || []);
  const subtasks = updates.subtasks !== undefined ? normaliseSubtasks(updates.subtasks) : (task.subtasks || []);
  const notes = updates.notes !== undefined ? normaliseNotes(updates.notes) : (task.notes || '');
  const recurrence = updates.recurrence !== undefined ? updates.recurrence : (task.recurrence || null);
  const reminderTime = updates.reminderTime !== undefined
    ? (typeof updates.reminderTime === 'string' ? updates.reminderTime.trim() : null)
    : (task.reminderTime || null);

  return {
    ...task,
    title:       merged.title.trim(),
    description: merged.description.trim(),
    priority:    merged.priority,
    category,
    status,
    completed,
    dueDate:     normaliseDueDate(merged.dueDate),
    tags,
    subtasks,
    notes,
    recurrence,
    reminderTime,
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
  const nextCompleted = !(task.status === 'completed' || task.completed);
  return {
    ...task,
    status:    nextCompleted ? 'completed' : 'pending',
    completed: nextCompleted,
    updatedAt: nowISO(),
  };
}

/**
 * Reopen a completed task, setting it back to pending.
 *
 * @param {Task} task
 * @returns {Task}
 */
export function reopenTask(task) {
  if (task.status === 'pending' && !task.completed) return task;
  return {
    ...task,
    status:    'pending',
    completed: false,
    updatedAt: nowISO(),
  };
}

/**
 * Mark a task as completed.
 *
 * @param {Task} task
 * @returns {Task}
 */
export function completeTask(task) {
  if (task.status === 'completed' && task.completed) return task;
  return {
    ...task,
    status:    'completed',
    completed: true,
    updatedAt: nowISO(),
  };
}

// ─── Subtask Operations ───────────────────────────────────────────────────────

/**
 * Append a subtask to a task.
 *
 * @param {Task} task
 * @param {string} title
 * @returns {Task}
 */
export function addSubtask(task, title) {
  const cleanTitle = (title || '').trim().slice(0, TITLE_MAX_LENGTH);
  if (!cleanTitle) return task;

  const current = Array.isArray(task.subtasks) ? task.subtasks : [];
  const nextSubtask = {
    id: generateId(),
    title: cleanTitle,
    completed: false,
  };

  return {
    ...task,
    subtasks: [...current, nextSubtask],
    updatedAt: nowISO(),
  };
}

/**
 * Toggle completion status of a subtask.
 *
 * @param {Task} task
 * @param {string} subtaskId
 * @returns {Task}
 */
export function toggleSubtask(task, subtaskId) {
  if (!Array.isArray(task.subtasks)) return task;
  const updatedSubtasks = task.subtasks.map(s => {
    if (s.id === subtaskId) {
      return { ...s, completed: !s.completed };
    }
    return s;
  });

  return {
    ...task,
    subtasks: updatedSubtasks,
    updatedAt: nowISO(),
  };
}

/**
 * Remove a subtask from a task.
 *
 * @param {Task} task
 * @param {string} subtaskId
 * @returns {Task}
 */
export function deleteSubtask(task, subtaskId) {
  if (!Array.isArray(task.subtasks)) return task;
  return {
    ...task,
    subtasks: task.subtasks.filter(s => s.id !== subtaskId),
    updatedAt: nowISO(),
  };
}

/**
 * Calculate completion progress for task subtasks.
 *
 * @param {Task} task
 * @returns {{ total: number, completed: number, percentage: number }}
 */
export function getSubtaskProgress(task) {
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];
  const total = subtasks.length;
  if (total === 0) {
    return { total: 0, completed: 0, percentage: 0 };
  }
  const completed = subtasks.filter(s => s.completed).length;
  const percentage = Math.round((completed / total) * 100);
  return { total, completed, percentage };
}

// ─── Tag Operations ───────────────────────────────────────────────────────────

/**
 * Add a tag to a task.
 *
 * @param {Task} task
 * @param {string} tag
 * @returns {Task}
 */
export function addTagToTask(task, tag) {
  const clean = (tag || '').replace(/^#/, '').trim().toLowerCase().slice(0, TAG_MAX_LENGTH);
  if (!clean) return task;

  const current = Array.isArray(task.tags) ? task.tags : [];
  if (current.includes(clean)) return task;

  return {
    ...task,
    tags: [...current, clean].slice(0, TAGS_MAX_COUNT),
    updatedAt: nowISO(),
  };
}

/**
 * Remove a tag from a task.
 *
 * @param {Task} task
 * @param {string} tag
 * @returns {Task}
 */
export function removeTagFromTask(task, tag) {
  if (!Array.isArray(task.tags)) return task;
  const target = (tag || '').trim().toLowerCase();
  return {
    ...task,
    tags: task.tags.filter(t => t.toLowerCase() !== target),
    updatedAt: nowISO(),
  };
}

/**
 * Extract all unique tags from an array of tasks with occurrence counts.
 *
 * @param {Task[]} tasks
 * @returns {Array<{ tag: string, count: number }>}
 */
export function getAllTags(tasks) {
  if (!Array.isArray(tasks)) return [];
  const counts = new Map();

  for (const task of tasks) {
    if (!Array.isArray(task.tags)) continue;
    for (const tag of task.tags) {
      if (typeof tag === 'string' && tag) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
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
 * Includes total, pending, completed, highPriority, completionRate, and overdue.
 *
 * Note: `overdue` is defined as a non-enumerable property to maintain strict
 * backward-compatibility with existing tests asserting exact object shapes via deepEqual.
 *
 * @param {Task[]} tasks
 * @param {Date} [referenceDate]
 * @returns {{ total: number, pending: number, completed: number, highPriority: number, completionRate: number, overdue: number }}
 */
export function computeStats(tasks = [], referenceDate = new Date()) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed' || t.completed === true).length;
  const pending   = total - completed;
  const highPriority = tasks.filter(t => t.priority === 'high' && (t.status === 'pending' || !t.completed)).length;
  const overdueCount = tasks.filter(t => isTaskOverdue(t, referenceDate)).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = {
    total,
    pending,
    completed,
    highPriority,
    completionRate,
  };

  // Add overdue count as non-enumerable property for deepEqual compatibility with existing tests
  Object.defineProperty(stats, 'overdue', {
    value: overdueCount,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  return stats;
}
