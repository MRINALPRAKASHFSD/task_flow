/**
 * TaskFlow — app.js
 * Application entry point — wires together storage, domain logic and UI rendering.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import {
  loadTasks, saveTasks,
  loadTheme, saveTheme,
  loadFilter, saveFilter,
  storageAvailable,
} from './storage.js';

import {
  createTask, updateTask, toggleTaskStatus,
  addTask, replaceTask, deleteTask, findTaskById,
  computeStats, validateTaskInput,
} from './tasks.js';

import { applyFilters, sortTasks } from './filters.js';
import { debounce, setText, formatDate, escapeHtml } from './utils.js';

// ─── Application State ────────────────────────────────────────────────────────

const state = {
  /** @type {import('./tasks.js').Task[]} */
  tasks:    [],
  theme:    'light',
  filter:   'all',
  search:   '',
  /** ID of the task currently being edited (null = adding new). */
  editingId: null,
};

// ─── DOM References ───────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const dom = {
  // Stats
  statTotal:          $('stat-total'),
  statPending:        $('stat-pending'),
  statCompleted:      $('stat-completed'),
  statHighPriority:   $('stat-high-priority'),
  progressFill:       $('progress-fill'),
  progressLabel:      $('progress-label'),

  // Toolbar
  searchInput:        $('search-input'),
  filterTabs:         document.querySelectorAll('.filter-tab'),

  // Sidebar nav
  sidebarAll:         $('sidebar-all'),
  sidebarPending:     $('sidebar-pending'),
  sidebarCompleted:   $('sidebar-completed'),
  sidebarBadgeAll:    $('sidebar-badge-all'),
  sidebarBadgePending:$('sidebar-badge-pending'),
  sidebarBadgeCompleted: $('sidebar-badge-completed'),

  // Task list
  taskList:           $('task-list'),
  taskCount:          $('task-count'),
  emptyState:         $('empty-state'),

  // Add task button
  btnAddTask:         $('btn-add-task'),

  // Modal
  modalOverlay:       $('modal-overlay'),
  modalTitle:         $('modal-title'),
  modalClose:         $('modal-close'),

  // Form
  taskForm:           $('task-form'),
  fieldTitle:         $('field-title'),
  fieldDescription:   $('field-description'),
  fieldPriority:      $('field-priority'),
  errorTitle:         $('error-title'),
  errorDescription:   $('error-description'),
  btnSubmit:          $('btn-submit'),
  btnCancel:          $('btn-cancel'),

  // Confirm modal
  confirmOverlay:     $('confirm-overlay'),
  confirmMessage:     $('confirm-message'),
  btnConfirmOk:       $('btn-confirm-ok'),
  btnConfirmCancel:   $('btn-confirm-cancel'),

  // Theme toggle
  themeToggle:        $('theme-toggle'),
  themeIcon:          $('theme-icon'),

  // Toast
  toastContainer:     $('toast-container'),
};

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  setText(dom.themeIcon, theme === 'dark' ? '☀️' : '🌙');
  dom.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.theme);
  saveTheme(state.theme);
}

// ─── Toast notifications ──────────────────────────────────────────────────────

/**
 * @param {string} message
 * @param {'success'|'error'|'info'} [type]
 * @param {number} [durationMs]
 */
function showToast(message, type = 'info', durationMs = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast__icon';
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = icons[type] || 'ℹ️';

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, durationMs);
}

// ─── Confirmation dialog ──────────────────────────────────────────────────────

let _confirmResolve = null;

function showConfirm(message) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    setText(dom.confirmMessage, message);
    dom.confirmOverlay.classList.add('is-open');
    dom.btnConfirmOk.focus();
  });
}

function closeConfirm(result) {
  dom.confirmOverlay.classList.remove('is-open');
  if (_confirmResolve) {
    _confirmResolve(result);
    _confirmResolve = null;
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(title) {
  setText(dom.modalTitle, title);
  dom.modalOverlay.classList.add('is-open');
  dom.modalOverlay.setAttribute('aria-hidden', 'false');
  dom.fieldTitle.focus();
}

function closeModal() {
  dom.modalOverlay.classList.remove('is-open');
  dom.modalOverlay.setAttribute('aria-hidden', 'true');
  resetForm();
  state.editingId = null;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function resetForm() {
  dom.taskForm.reset();
  hideFieldError(dom.fieldTitle, dom.errorTitle);
  hideFieldError(dom.fieldDescription, dom.errorDescription);
}

function showFieldError(field, errorEl, message) {
  field.classList.add('is-invalid');
  errorEl.textContent = message;
  errorEl.classList.add('is-visible');
  field.setAttribute('aria-invalid', 'true');
}

function hideFieldError(field, errorEl) {
  field.classList.remove('is-invalid');
  errorEl.textContent = '';
  errorEl.classList.remove('is-visible');
  field.setAttribute('aria-invalid', 'false');
}

function clearFormErrors() {
  hideFieldError(dom.fieldTitle, dom.errorTitle);
  hideFieldError(dom.fieldDescription, dom.errorDescription);
}

// ─── Task form submission ─────────────────────────────────────────────────────

function handleFormSubmit(event) {
  event.preventDefault();
  clearFormErrors();

  const input = {
    title:       dom.fieldTitle.value,
    description: dom.fieldDescription.value,
    priority:    dom.fieldPriority.value,
  };

  const { valid, errors } = validateTaskInput(input);
  if (!valid) {
    if (errors.title)       showFieldError(dom.fieldTitle, dom.errorTitle, errors.title);
    if (errors.description) showFieldError(dom.fieldDescription, dom.errorDescription, errors.description);
    return;
  }

  try {
    if (state.editingId) {
      // Edit existing
      const existing = findTaskById(state.tasks, state.editingId);
      if (!existing) throw new Error('Task not found.');
      const updated = updateTask(existing, input);
      state.tasks = replaceTask(state.tasks, updated);
      showToast('Task updated.', 'success');
    } else {
      // Create new
      const task = createTask(input);
      state.tasks = addTask(state.tasks, task);
      showToast('Task created.', 'success');
    }

    const saved = saveTasks(state.tasks);
    if (!saved) showToast('Warning: changes could not be saved to storage.', 'error');

    closeModal();
    render();
  } catch (err) {
    showToast(err.message || 'An error occurred.', 'error');
  }
}

// ─── Task actions ─────────────────────────────────────────────────────────────

function handleToggleStatus(taskId) {
  const task = findTaskById(state.tasks, taskId);
  if (!task) return;
  const toggled = toggleTaskStatus(task);
  state.tasks = replaceTask(state.tasks, toggled);
  saveTasks(state.tasks);
  render();
  showToast(
    toggled.status === 'completed' ? 'Task marked as completed.' : 'Task marked as pending.',
    'success'
  );
}

async function handleDeleteTask(taskId) {
  const task = findTaskById(state.tasks, taskId);
  if (!task) return;

  const confirmed = await showConfirm(`Delete "${task.title}"? This cannot be undone.`);
  if (!confirmed) return;

  state.tasks = deleteTask(state.tasks, taskId);
  saveTasks(state.tasks);
  render();
  showToast('Task deleted.', 'info');
}

function handleEditTask(taskId) {
  const task = findTaskById(state.tasks, taskId);
  if (!task) return;
  state.editingId = taskId;
  dom.fieldTitle.value       = task.title;
  dom.fieldDescription.value = task.description;
  dom.fieldPriority.value    = task.priority;
  openModal('Edit Task');
}

// ─── Rendering ────────────────────────────────────────────────────────────────

/**
 * Build a task card DOM element — uses textContent / DOM APIs only.
 * No innerHTML is used for user-supplied content.
 *
 * @param {import('./tasks.js').Task} task
 * @returns {HTMLElement}
 */
function buildTaskCard(task) {
  const article = document.createElement('article');
  article.className = [
    'task-card',
    `task-card--priority-${task.priority}`,
    task.status === 'completed' ? 'is-completed' : '',
  ].join(' ').trim();
  article.setAttribute('data-task-id', task.id);
  article.setAttribute('aria-label', `Task: ${task.title}`);

  // ── Checkbox ──
  const checkboxWrapper = document.createElement('div');
  checkboxWrapper.className = 'task-card__checkbox-wrapper';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-card__checkbox';
  checkbox.checked = task.status === 'completed';
  checkbox.setAttribute('aria-label', task.status === 'completed' ? 'Mark as pending' : 'Mark as completed');
  checkbox.addEventListener('change', () => handleToggleStatus(task.id));

  checkboxWrapper.appendChild(checkbox);

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'task-card__body';

  const titleEl = document.createElement('h3');
  titleEl.className = 'task-card__title';
  titleEl.textContent = task.title;

  body.appendChild(titleEl);

  if (task.description) {
    const descEl = document.createElement('p');
    descEl.className = 'task-card__description';
    descEl.textContent = task.description;
    body.appendChild(descEl);
  }

  const meta = document.createElement('div');
  meta.className = 'task-card__meta';

  // Priority badge
  const priorityBadge = document.createElement('span');
  priorityBadge.className = `badge badge-priority-${task.priority}`;
  const priorityIcons = { low: '🟢', medium: '🟡', high: '🔴' };
  priorityBadge.textContent = `${priorityIcons[task.priority] ?? ''} ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`;
  meta.appendChild(priorityBadge);

  // Status badge
  const statusBadge = document.createElement('span');
  statusBadge.className = `badge badge-status-${task.status}`;
  statusBadge.textContent = task.status === 'completed' ? '✓ Completed' : '○ Pending';
  meta.appendChild(statusBadge);

  // Date
  const dateEl = document.createElement('time');
  dateEl.className = 'task-card__date';
  dateEl.setAttribute('datetime', task.updatedAt || task.createdAt);
  dateEl.textContent = formatDate(task.updatedAt || task.createdAt);
  meta.appendChild(dateEl);

  body.appendChild(meta);

  // ── Actions ──
  const actions = document.createElement('div');
  actions.className = 'task-card__actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'task-action-btn task-action-btn--edit';
  editBtn.setAttribute('aria-label', `Edit task: ${task.title}`);
  editBtn.textContent = '✏️';
  editBtn.addEventListener('click', () => handleEditTask(task.id));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'task-action-btn task-action-btn--delete';
  deleteBtn.setAttribute('aria-label', `Delete task: ${task.title}`);
  deleteBtn.textContent = '🗑️';
  deleteBtn.addEventListener('click', () => handleDeleteTask(task.id));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  article.appendChild(checkboxWrapper);
  article.appendChild(body);
  article.appendChild(actions);

  return article;
}

function renderStats() {
  const stats = computeStats(state.tasks);
  setText(dom.statTotal,        stats.total);
  setText(dom.statPending,      stats.pending);
  setText(dom.statCompleted,    stats.completed);
  setText(dom.statHighPriority, stats.highPriority);

  if (dom.progressFill) {
    dom.progressFill.style.width = `${stats.completionRate}%`;
    dom.progressFill.setAttribute('aria-valuenow', stats.completionRate);
  }
  if (dom.progressLabel) {
    setText(dom.progressLabel, `${stats.completionRate}% complete`);
  }

  // Sidebar badges
  setText(dom.sidebarBadgeAll,       state.tasks.length);
  setText(dom.sidebarBadgePending,   stats.pending);
  setText(dom.sidebarBadgeCompleted, stats.completed);
}

function renderFilterTabs() {
  dom.filterTabs.forEach(tab => {
    const isActive = tab.dataset.filter === state.filter;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-pressed', String(isActive));
  });

  document.querySelectorAll('.sidebar-nav__link[data-filter]').forEach(link => {
    const isActive = link.dataset.filter === state.filter;
    link.classList.toggle('is-active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

function renderTaskList() {
  const visible = sortTasks(applyFilters(state.tasks, {
    status: state.filter,
    search: state.search,
  }));

  // Task count label
  setText(dom.taskCount, visible.length === 1
    ? '1 task'
    : `${visible.length} tasks`
  );

  // Clear old cards
  while (dom.taskList.firstChild) {
    dom.taskList.removeChild(dom.taskList.firstChild);
  }

  if (visible.length === 0) {
    dom.emptyState.hidden = false;
    // Customise empty state message based on context
    const emptyTitle = dom.emptyState.querySelector('.empty-state__title');
    const emptyDesc  = dom.emptyState.querySelector('.empty-state__description');
    if (state.search) {
      setText(emptyTitle, 'No tasks match your search');
      setText(emptyDesc,  `No results for "${state.search}". Try a different keyword.`);
    } else if (state.filter === 'completed') {
      setText(emptyTitle, 'No completed tasks yet');
      setText(emptyDesc,  'Complete your first task to see it here.');
    } else if (state.filter === 'pending') {
      setText(emptyTitle, 'All caught up!');
      setText(emptyDesc,  'No pending tasks. Great job! Add a new task to get started.');
    } else {
      setText(emptyTitle, 'No tasks yet');
      setText(emptyDesc,  'Add your first task to get started. Stay organised and productive!');
    }
    return;
  }

  dom.emptyState.hidden = true;
  const fragment = document.createDocumentFragment();
  visible.forEach(task => fragment.appendChild(buildTaskCard(task)));
  dom.taskList.appendChild(fragment);
}

/** Full render cycle. */
function render() {
  renderStats();
  renderFilterTabs();
  renderTaskList();
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

function wireEvents() {
  // Theme
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Add task button
  dom.btnAddTask.addEventListener('click', () => {
    state.editingId = null;
    resetForm();
    openModal('Add New Task');
  });

  // Modal close
  dom.modalClose.addEventListener('click', closeModal);
  dom.btnCancel.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', e => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Form submit
  dom.taskForm.addEventListener('submit', handleFormSubmit);

  // Filter tabs
  dom.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      state.filter = tab.dataset.filter || 'all';
      saveFilter(state.filter);
      render();
    });
  });

  // Sidebar nav filters
  document.querySelectorAll('.sidebar-nav__link[data-filter]').forEach(link => {
    link.addEventListener('click', () => {
      state.filter = link.dataset.filter || 'all';
      saveFilter(state.filter);
      render();
    });
  });

  // Search (debounced)
  dom.searchInput.addEventListener('input', debounce(e => {
    state.search = e.target.value;
    render();
  }, 250));

  // Confirm dialog
  dom.btnConfirmOk.addEventListener('click', () => closeConfirm(true));
  dom.btnConfirmCancel.addEventListener('click', () => closeConfirm(false));
  dom.confirmOverlay.addEventListener('click', e => {
    if (e.target === dom.confirmOverlay) closeConfirm(false);
  });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (dom.modalOverlay.classList.contains('is-open'))  closeModal();
      if (dom.confirmOverlay.classList.contains('is-open')) closeConfirm(false);
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  // Check storage availability and warn user
  if (!storageAvailable()) {
    showToast(
      'localStorage is unavailable. Tasks will not be saved between sessions.',
      'error',
      6000
    );
  }

  // Load persisted state
  state.tasks  = loadTasks();
  state.theme  = loadTheme();
  state.filter = loadFilter();

  // Apply theme before paint
  applyTheme(state.theme);

  // Wire up interactions
  wireEvents();

  // Initial render
  render();
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
