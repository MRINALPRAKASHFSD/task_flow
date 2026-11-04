/**
 * TaskFlow — app.js
 * Application controller — state coordination, DOM event wiring, and dynamic rendering.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import {
  loadAppState,
  saveAppState,
  saveTasks,
  saveTheme,
  saveFilter,
  storageAvailable,
  exportAppStateJSON,
  importAppStateJSON,
} from './storage.js';

import {
  createTask,
  updateTask,
  toggleTaskStatus,
  addTask,
  replaceTask,
  deleteTask,
  findTaskById,
  computeStats,
  validateTaskInput,
  isTaskOverdue,
  isTaskDueToday,
  isTaskUpcoming,
  CATEGORIES,
} from './tasks.js';

import {
  applyFilters,
  sortTasks,
} from './filters.js';

import {
  debounce,
  setText,
  formatDate,
  formatDueDate,
  formatHeaderDate,
  getGreeting,
  trapFocus,
} from './utils.js';

import {
  createEditIcon,
  createDeleteIcon,
  createCheckIcon,
  createCalendarIcon,
  createAlertIcon,
  createClockIcon,
  createFlameIcon,
  createSunIcon,
  createMoonIcon,
  createPlusIcon,
  createSearchIcon,
  createCloseIcon,
  createSettingsIcon,
  createToastSuccessIcon,
  createToastErrorIcon,
  createToastInfoIcon,
  createPriorityDot,
} from './icons.js';

// ─── Application State ────────────────────────────────────────────────────────

const state = {
  /** @type {import('./tasks.js').Task[]} */
  tasks:        [],
  theme:        'light',
  filter:       'all',       // 'all' | 'today' | 'upcoming' | 'overdue' | 'pending' | 'completed' | 'high'
  category:     'all',       // 'all' | 'Work' | 'Personal' | 'Study' | 'Health' | 'Finance' | 'General'
  sortBy:       'default',   // 'default' | 'newest' | 'oldest' | 'priority' | 'dueDate' | 'updated'
  search:       '',
  editingId:    null,        // ID of task being edited, or null when creating
  isSubmitting: false,
};

// ─── DOM Elements Cache ───────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const dom = {
  // Header
  themeToggle:        $('theme-toggle'),
  themeIcon:          $('theme-icon'),
  btnHeaderAdd:       $('btn-header-add'),
  btnMobileNav:       $('btn-mobile-nav'),

  // Welcome banner
  welcomeGreeting:    $('welcome-greeting'),
  welcomeDate:        $('welcome-date'),
  welcomeSubtitle:    $('welcome-subtitle'),

  // Sidebar navigation
  appSidebar:         $('app-sidebar'),
  sidebarOverlay:     $('sidebar-overlay'),
  sidebarAll:         $('sidebar-all'),
  sidebarToday:       $('sidebar-today'),
  sidebarUpcoming:    $('sidebar-upcoming'),
  sidebarOverdue:     $('sidebar-overdue'),
  sidebarPending:     $('sidebar-pending'),
  sidebarCompleted:   $('sidebar-completed'),
  sidebarHigh:        $('sidebar-high'),
  sidebarBadgeAll:    $('sidebar-badge-all'),
  sidebarBadgeToday:  $('sidebar-badge-today'),
  sidebarBadgeUpcoming: $('sidebar-badge-upcoming'),
  sidebarBadgeOverdue:  $('sidebar-badge-overdue'),
  sidebarBadgePending:  $('sidebar-badge-pending'),
  sidebarBadgeCompleted: $('sidebar-badge-completed'),
  sidebarBadgeHigh:   $('sidebar-badge-high'),
  sidebarCategoryLinks: document.querySelectorAll('.sidebar-nav__link[data-category]'),

  // Statistics
  statTotal:          $('stat-total'),
  statPending:        $('stat-pending'),
  statCompleted:      $('stat-completed'),
  statOverdue:        $('stat-overdue'),
  statHighPriority:   $('stat-high-priority'),
  progressFill:       $('progress-fill'),
  progressLabel:      $('progress-label'),

  // Toolbar
  searchInput:        $('search-input'),
  searchClear:        $('search-clear'),
  filterTabs:         document.querySelectorAll('.filter-tab'),
  filterCategorySelect: $('filter-category-select'),
  sortSelect:         $('sort-select'),
  btnAddTask:         $('btn-add-task'),

  // Task list & Views
  viewTitle:          $('view-title'),
  viewCategoryBadge:  $('view-category-badge'),
  taskCount:          $('task-count'),
  taskList:           $('task-list'),
  emptyState:         $('empty-state'),
  btnEmptyAdd:        $('btn-empty-add'),

  // Modal dialog
  modalOverlay:       $('modal-overlay'),
  modalTitle:         $('modal-title'),
  modalClose:         $('modal-close'),
  taskForm:           $('task-form'),
  fieldTitle:         $('field-title'),
  fieldDescription:   $('field-description'),
  fieldPriority:      $('field-priority'),
  fieldCategory:      $('field-category'),
  fieldDueDate:       $('field-due-date'),
  errorTitle:         $('error-title'),
  errorDescription:   $('error-description'),
  errorDueDate:       $('error-due-date'),
  titleCounter:       $('title-counter'),
  descCounter:        $('desc-counter'),
  btnSubmit:          $('btn-submit'),
  btnCancel:          $('btn-cancel'),

  // Delete Confirmation dialog
  confirmOverlay:     $('confirm-overlay'),
  confirmMessage:     $('confirm-message'),
  btnConfirmOk:       $('btn-confirm-ok'),
  btnConfirmCancel:   $('btn-confirm-cancel'),

  // Settings & Data Management dialog
  sidebarSettings:    $('sidebar-settings'),
  settingsOverlay:    $('settings-overlay'),
  settingsClose:      $('settings-close'),
  btnThemeLight:      $('btn-theme-light'),
  btnThemeDark:       $('btn-theme-dark'),
  btnExportJson:      $('btn-export-json'),
  importFileInput:    $('import-file-input'),
  btnClearCompleted:  $('btn-clear-completed'),
  btnClearAll:        $('btn-clear-all'),

  // Toast notifications
  toastContainer:     $('toast-container'),
};

// ─── Theme Management ─────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (dom.themeIcon) {
    dom.themeIcon.replaceChildren(theme === 'dark' ? createSunIcon(18) : createMoonIcon(18));
  }
  dom.themeToggle.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  );
  if (dom.btnThemeLight && dom.btnThemeDark) {
    dom.btnThemeLight.classList.toggle('is-active', theme === 'light');
    dom.btnThemeDark.classList.toggle('is-active', theme === 'dark');
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.theme);
  saveTheme(state.theme);
  persistState();
  showToast(state.theme === 'dark' ? 'Dark theme enabled.' : 'Light theme enabled.', 'info', 2000);
}

// ─── Mobile Sidebar Navigation ────────────────────────────────────────────────

function openMobileNav() {
  dom.appSidebar.classList.add('is-open');
  dom.sidebarOverlay.classList.add('is-open');
  dom.btnMobileNav.setAttribute('aria-expanded', 'true');
}

function closeMobileNav() {
  dom.appSidebar.classList.remove('is-open');
  dom.sidebarOverlay.classList.remove('is-open');
  dom.btnMobileNav.setAttribute('aria-expanded', 'false');
}

// ─── Toast Notifications ──────────────────────────────────────────────────────

/**
 * Display a non-blocking toast notification.
 *
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [durationMs=3200]
 */
function showToast(message, type = 'info', durationMs = 3200) {
  if (!dom.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast__icon';
  iconSpan.setAttribute('aria-hidden', 'true');

  let iconSvg = null;
  if (type === 'success') {
    iconSvg = createToastSuccessIcon(18);
  } else if (type === 'error') {
    iconSvg = createToastErrorIcon(18);
  } else {
    iconSvg = createToastInfoIcon(18);
  }
  if (iconSvg) iconSpan.appendChild(iconSvg);

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

// ─── State Persistence ────────────────────────────────────────────────────────

function persistState() {
  saveAppState({
    version: 1,
    tasks: state.tasks,
    preferences: {
      theme:    state.theme,
      filter:   state.filter,
      category: state.category,
      sortBy:   state.sortBy,
    },
  });
}

// ─── Dialog Focus & Background Management ────────────────────────────────────

let confirmInvokingElement = null;
let settingsInvokingElement = null;
let modalInvokingElement = null;

function setBackgroundInert(inert) {
  const layout = document.querySelector('.app-layout');
  if (!layout) return;
  if (inert) {
    layout.setAttribute('aria-hidden', 'true');
  } else {
    // Only remove aria-hidden if NO modal/dialog is currently open
    const isAnyOpen =
      (dom.modalOverlay && dom.modalOverlay.classList.contains('is-open')) ||
      (dom.settingsOverlay && dom.settingsOverlay.classList.contains('is-open')) ||
      (dom.confirmOverlay && dom.confirmOverlay.classList.contains('is-open'));
    if (!isAnyOpen) {
      layout.removeAttribute('aria-hidden');
    }
  }
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────

let _confirmResolve = null;

function showConfirm(message) {
  return new Promise((resolve) => {
    _confirmResolve = resolve;
    confirmInvokingElement = document.activeElement;
    setText(dom.confirmMessage, message);
    dom.confirmOverlay.classList.add('is-open');
    dom.confirmOverlay.setAttribute('aria-hidden', 'false');
    setBackgroundInert(true);
    // Focus Cancel first to prevent accidental confirmation via Enter
    if (dom.btnConfirmCancel) {
      dom.btnConfirmCancel.focus();
    } else if (dom.btnConfirmOk) {
      dom.btnConfirmOk.focus();
    }
  });
}

function closeConfirm(result) {
  dom.confirmOverlay.classList.remove('is-open');
  dom.confirmOverlay.setAttribute('aria-hidden', 'true');
  setBackgroundInert(false);

  // Restore focus to invoking element if still connected and settings is not active
  if (dom.settingsOverlay && dom.settingsOverlay.classList.contains('is-open')) {
    if (dom.btnClearCompleted) dom.btnClearCompleted.focus();
  } else if (confirmInvokingElement && typeof confirmInvokingElement.focus === 'function') {
    confirmInvokingElement.focus();
  }
  confirmInvokingElement = null;

  if (_confirmResolve) {
    _confirmResolve(result);
    _confirmResolve = null;
  }
}

// ─── Settings Modal Dialog ───────────────────────────────────────────────────

function openSettings() {
  if (!dom.settingsOverlay) return;
  settingsInvokingElement = document.activeElement;
  if (dom.btnThemeLight && dom.btnThemeDark) {
    dom.btnThemeLight.classList.toggle('is-active', state.theme === 'light');
    dom.btnThemeDark.classList.toggle('is-active', state.theme === 'dark');
  }
  dom.settingsOverlay.classList.add('is-open');
  dom.settingsOverlay.setAttribute('aria-hidden', 'false');
  setBackgroundInert(true);
  if (dom.settingsClose) dom.settingsClose.focus();
}

function closeSettings() {
  if (!dom.settingsOverlay) return;
  dom.settingsOverlay.classList.remove('is-open');
  dom.settingsOverlay.setAttribute('aria-hidden', 'true');
  setBackgroundInert(false);

  if (settingsInvokingElement && typeof settingsInvokingElement.focus === 'function') {
    settingsInvokingElement.focus();
  } else if (dom.sidebarSettings) {
    dom.sidebarSettings.focus();
  }
  settingsInvokingElement = null;
}

function handleExportJSON() {
  let url = null;
  try {
    const jsonStr = exportAppStateJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `taskflow-backup-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Tasks exported successfully.', 'success');
  } catch (err) {
    showToast('Failed to export tasks: ' + err.message, 'error');
  } finally {
    if (url) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch (_e) {}
      }, 1000);
    }
  }
}

function handleImportJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // Enforce size limit (max 5MB to prevent memory exhaustion)
  if (file.size > 5 * 1024 * 1024) {
    showToast('Selected file exceeds 5MB limit. Please choose a valid JSON backup.', 'error');
    if (dom.importFileInput) dom.importFileInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const content = event.target?.result;
      if (typeof content !== 'string') {
        showToast('Failed to read file content.', 'error');
        return;
      }
      const res = importAppStateJSON(content);
      if (res.success) {
        const refreshed = loadAppState();
        state.tasks = refreshed.tasks;
        state.theme = refreshed.preferences?.theme || state.theme;
        state.filter = refreshed.preferences?.filter || 'all';
        state.category = refreshed.preferences?.category || 'all';
        state.sortBy = refreshed.preferences?.sortBy || 'default';
        applyTheme(state.theme);
        render();
        closeSettings();
        showToast(`Imported ${res.count} task(s) successfully.`, 'success');
      } else {
        showToast(res.error || 'Import failed.', 'error');
      }
    } catch (err) {
      showToast('Error parsing file: ' + err.message, 'error');
    } finally {
      if (dom.importFileInput) dom.importFileInput.value = '';
    }
  };
  reader.onerror = () => {
    showToast('Error reading uploaded file.', 'error');
    if (dom.importFileInput) dom.importFileInput.value = '';
  };
  reader.readAsText(file);
}

async function handleClearCompletedTasks() {
  const completedCount = state.tasks.filter((t) => t.status === 'completed' || t.completed).length;
  if (completedCount === 0) {
    showToast('No completed tasks to clear.', 'info');
    return;
  }

  const confirmed = await showConfirm(
    `Are you sure you want to delete all ${completedCount} completed task(s)?`
  );
  if (!confirmed) return;

  state.tasks = state.tasks.filter((t) => t.status !== 'completed' && !t.completed);
  saveTasks(state.tasks);
  persistState();
  render();
  closeSettings();
  showToast(`Cleared ${completedCount} completed task(s).`, 'success');
}

async function handleResetAllTasks() {
  if (state.tasks.length === 0) {
    showToast('Your task list is already empty.', 'info');
    return;
  }

  const confirmed = await showConfirm(
    'Warning: This will permanently delete ALL tasks and reset your dashboard. Continue?'
  );
  if (!confirmed) return;

  state.tasks = [];
  saveTasks([]);
  persistState();
  render();
  closeSettings();
  showToast('All tasks have been reset.', 'info');
}

// ─── Task Modal Dialog & Character Counters ───────────────────────────────────

function updateCharCounters() {
  if (dom.titleCounter && dom.fieldTitle) {
    const tLen = dom.fieldTitle.value.length;
    dom.titleCounter.textContent = `${tLen} / 200`;
    dom.titleCounter.classList.toggle('is-limit', tLen >= 190);
  }
  if (dom.descCounter && dom.fieldDescription) {
    const dLen = dom.fieldDescription.value.length;
    dom.descCounter.textContent = `${dLen} / 1000`;
    dom.descCounter.classList.toggle('is-limit', dLen >= 950);
  }
}

function openModal(title) {
  modalInvokingElement = document.activeElement;
  setText(dom.modalTitle, title);
  dom.modalOverlay.classList.add('is-open');
  dom.modalOverlay.setAttribute('aria-hidden', 'false');
  setBackgroundInert(true);
  clearFormErrors();
  updateCharCounters();
  dom.fieldTitle.focus();
}

function closeModal() {
  dom.modalOverlay.classList.remove('is-open');
  dom.modalOverlay.setAttribute('aria-hidden', 'true');
  setBackgroundInert(false);
  resetForm();
  state.editingId = null;
  state.isSubmitting = false;
  if (modalInvokingElement && typeof modalInvokingElement.focus === 'function') {
    modalInvokingElement.focus();
  }
  modalInvokingElement = null;
}

function resetForm() {
  dom.taskForm.reset();
  dom.fieldCategory.value = 'General';
  dom.fieldPriority.value = 'medium';
  dom.fieldDueDate.value = '';
  clearFormErrors();
  updateCharCounters();
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
  if (dom.errorDueDate) hideFieldError(dom.fieldDueDate, dom.errorDueDate);
}

// ─── Form Submission Handling ─────────────────────────────────────────────────

function handleFormSubmit(event) {
  event.preventDefault();
  if (state.isSubmitting) return;

  clearFormErrors();

  const input = {
    title:       dom.fieldTitle.value,
    description: dom.fieldDescription.value,
    priority:    dom.fieldPriority.value,
    category:    dom.fieldCategory.value,
    dueDate:     dom.fieldDueDate.value || null,
  };

  const { valid, errors } = validateTaskInput(input);
  if (!valid) {
    if (errors.title) showFieldError(dom.fieldTitle, dom.errorTitle, errors.title);
    if (errors.description) showFieldError(dom.fieldDescription, dom.errorDescription, errors.description);
    if (errors.dueDate && dom.errorDueDate) showFieldError(dom.fieldDueDate, dom.errorDueDate, errors.dueDate);
    return;
  }

  state.isSubmitting = true;

  try {
    if (state.editingId) {
      // Edit existing task
      const existing = findTaskById(state.tasks, state.editingId);
      if (!existing) throw new Error('Task not found.');

      const updated = updateTask(existing, input);
      state.tasks = replaceTask(state.tasks, updated);
      showToast('Task updated successfully.', 'success');
    } else {
      // Create new task
      const task = createTask(input);
      state.tasks = addTask(state.tasks, task);
      showToast('Task created successfully.', 'success');
    }

    persistState();
    closeModal();
    render();
  } catch (err) {
    showToast(err.message || 'An error occurred while saving the task.', 'error');
  } finally {
    state.isSubmitting = false;
  }
}

// ─── Task Actions ─────────────────────────────────────────────────────────────

function handleToggleStatus(taskId) {
  const task = findTaskById(state.tasks, taskId);
  if (!task) return;

  const toggled = toggleTaskStatus(task);
  state.tasks = replaceTask(state.tasks, toggled);
  persistState();
  render();

  const msg = (toggled.status === 'completed' || toggled.completed)
    ? 'Task marked as completed.'
    : 'Task reopened.';
  showToast(msg, 'success', 2200);
}

async function handleDeleteTask(taskId) {
  const task = findTaskById(state.tasks, taskId);
  if (!task) return;

  const confirmed = await showConfirm(`Are you sure you want to delete "${task.title}"? This cannot be undone.`);
  if (!confirmed) return;

  state.tasks = deleteTask(state.tasks, taskId);
  persistState();
  render();
  showToast('Task deleted.', 'info', 2500);
}

function handleEditTask(taskId) {
  const task = findTaskById(state.tasks, taskId);
  if (!task) return;

  state.editingId = taskId;
  dom.fieldTitle.value       = task.title;
  dom.fieldDescription.value = task.description || '';
  dom.fieldPriority.value    = task.priority || 'medium';
  dom.fieldCategory.value    = task.category || 'General';
  dom.fieldDueDate.value     = task.dueDate || '';

  openModal('Edit Task');
}

// ─── DOM Card Builder ─────────────────────────────────────────────────────────

/**
 * Build a task card element using safe DOM APIs.
 *
 * @param {import('./tasks.js').Task} task
 * @param {Date} referenceDate
 * @returns {HTMLElement}
 */
function buildTaskCard(task, referenceDate) {
  const isCompleted = task.status === 'completed' || task.completed === true;

  const article = document.createElement('article');
  article.className = [
    'task-card',
    `task-card--priority-${task.priority || 'medium'}`,
    isCompleted ? 'is-completed' : '',
  ].join(' ').trim();
  article.setAttribute('data-task-id', task.id);
  article.setAttribute('aria-label', `Task: ${task.title}`);

  // Checkbox wrapper
  const checkboxWrapper = document.createElement('div');
  checkboxWrapper.className = 'task-card__checkbox-wrapper';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-card__checkbox';
  checkbox.checked = isCompleted;
  checkbox.setAttribute('aria-label', isCompleted ? 'Reopen task' : 'Mark task completed');
  checkbox.addEventListener('change', () => handleToggleStatus(task.id));

  checkboxWrapper.appendChild(checkbox);

  // Body
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

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'task-card__meta';

  // Category badge
  const categoryName = task.category || 'General';
  const catSlug = categoryName.toLowerCase();
  const catBadge = document.createElement('span');
  catBadge.className = `badge badge-cat-${catSlug} badge-category`;
  catBadge.textContent = categoryName;
  meta.appendChild(catBadge);

  // Priority badge
  const priorityBadge = document.createElement('span');
  priorityBadge.className = `badge badge-priority-${task.priority}`;
  const dot = createPriorityDot(task.priority);
  if (dot) priorityBadge.appendChild(dot);
  const pLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  priorityBadge.appendChild(document.createTextNode(` ${pLabel}`));
  meta.appendChild(priorityBadge);

  // Due date badge (if present)
  if (task.dueDate) {
    const dueBadge = document.createElement('span');
    const isOverdue = isTaskOverdue(task, referenceDate);
    const isToday = isTaskDueToday(task, referenceDate);

    let dueClass = 'badge-due-upcoming';
    let dueSvg = createCalendarIcon(13);

    if (isOverdue) {
      dueClass = 'badge-due-overdue';
      dueSvg = createAlertIcon(13);
    } else if (isToday) {
      dueClass = 'badge-due-today';
      dueSvg = createClockIcon(13);
    }

    dueBadge.className = `badge ${dueClass}`;
    if (dueSvg) dueBadge.appendChild(dueSvg);
    dueBadge.appendChild(document.createTextNode(` ${formatDueDate(task.dueDate, referenceDate)}`));
    meta.appendChild(dueBadge);
  }

  // Status badge
  const statusBadge = document.createElement('span');
  statusBadge.className = `badge badge-status-${isCompleted ? 'completed' : 'pending'}`;
  if (isCompleted) {
    const checkSvg = createCheckIcon(12);
    if (checkSvg) statusBadge.appendChild(checkSvg);
    statusBadge.appendChild(document.createTextNode(' Completed'));
  } else {
    statusBadge.textContent = '○ Pending';
  }
  meta.appendChild(statusBadge);

  // Date (relative)
  const dateEl = document.createElement('time');
  dateEl.className = 'task-card__date';
  const targetDate = task.updatedAt || task.createdAt;
  dateEl.setAttribute('datetime', targetDate);
  dateEl.textContent = formatDate(targetDate);
  meta.appendChild(dateEl);

  body.appendChild(meta);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'task-card__actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'task-action-btn task-action-btn--edit';
  editBtn.setAttribute('aria-label', `Edit task: ${task.title}`);
  const editSvg = createEditIcon(14);
  if (editSvg) editBtn.appendChild(editSvg);
  editBtn.addEventListener('click', () => handleEditTask(task.id));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'task-action-btn task-action-btn--delete';
  deleteBtn.setAttribute('aria-label', `Delete task: ${task.title}`);
  const deleteSvg = createDeleteIcon(14);
  if (deleteSvg) deleteBtn.appendChild(deleteSvg);
  deleteBtn.addEventListener('click', () => handleDeleteTask(task.id));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  article.appendChild(checkboxWrapper);
  article.appendChild(body);
  article.appendChild(actions);

  return article;
}

// ─── Rendering Methods ────────────────────────────────────────────────────────

function renderWelcomeHeader() {
  const now = new Date();
  if (dom.welcomeGreeting) setText(dom.welcomeGreeting, `${getGreeting(now)}, Mrinal`);
  if (dom.welcomeDate) setText(dom.welcomeDate, formatHeaderDate(now));
}

function renderStats() {
  const now = new Date();
  const stats = computeStats(state.tasks, now);

  setText(dom.statTotal,        stats.total);
  setText(dom.statPending,      stats.pending);
  setText(dom.statCompleted,    stats.completed);
  setText(dom.statOverdue,      stats.overdue || 0);
  setText(dom.statHighPriority, stats.highPriority);

  if (dom.progressFill) {
    dom.progressFill.style.width = `${stats.completionRate}%`;
  }
  if (dom.progressLabel) {
    setText(dom.progressLabel, `${stats.completionRate}% Completed`);
  }
}

function updateSidebarBadges() {
  const now = new Date();
  const total = state.tasks.length;
  const today = state.tasks.filter((t) => isTaskDueToday(t, now) && t.status !== 'completed' && !t.completed).length;
  const upcoming = state.tasks.filter((t) => isTaskUpcoming(t, now) && t.status !== 'completed' && !t.completed).length;
  const overdue = state.tasks.filter((t) => isTaskOverdue(t, now)).length;
  const pending = state.tasks.filter((t) => t.status !== 'completed' && !t.completed).length;
  const completed = state.tasks.filter((t) => t.status === 'completed' || t.completed).length;
  const high = state.tasks.filter((t) => t.priority === 'high' && t.status !== 'completed' && !t.completed).length;

  setText(dom.sidebarBadgeAll,       total);
  setText(dom.sidebarBadgeToday,     today);
  setText(dom.sidebarBadgeUpcoming,  upcoming);
  setText(dom.sidebarBadgeOverdue,   overdue);
  setText(dom.sidebarBadgePending,   pending);
  setText(dom.sidebarBadgeCompleted, completed);
  setText(dom.sidebarBadgeHigh,      high);

  if (dom.sidebarBadgeOverdue) {
    dom.sidebarBadgeOverdue.classList.toggle('sidebar-nav__badge--danger', overdue > 0);
  }
}

function updateActiveSidebarLink() {
  const allViewLinks = [
    dom.sidebarAll,
    dom.sidebarToday,
    dom.sidebarUpcoming,
    dom.sidebarOverdue,
    dom.sidebarPending,
    dom.sidebarCompleted,
    dom.sidebarHigh,
  ];

  allViewLinks.forEach((link) => {
    if (!link) return;
    const match = link.getAttribute('data-filter') === state.filter;
    link.classList.toggle('is-active', match);
    link.setAttribute('aria-current', match ? 'page' : 'false');
  });

  if (dom.sidebarCategoryLinks) {
    dom.sidebarCategoryLinks.forEach((link) => {
      const match = link.getAttribute('data-category') === state.category;
      link.classList.toggle('is-active', match);
      link.setAttribute('aria-current', match ? 'page' : 'false');
    });
  }
}

function updateViewTitle() {
  const titleMap = {
    all:       'All Tasks',
    today:     'Due Today',
    upcoming:  'Upcoming Tasks',
    overdue:   'Overdue Tasks',
    pending:   'Pending Tasks',
    completed: 'Completed Tasks',
    high:      'High Priority Tasks',
  };

  const title = titleMap[state.filter] || 'Tasks';
  setText(dom.viewTitle, title);

  if (dom.viewCategoryBadge) {
    if (state.category && state.category !== 'all') {
      dom.viewCategoryBadge.hidden = false;
      dom.viewCategoryBadge.textContent = state.category;
      dom.viewCategoryBadge.className = `badge badge-cat-${state.category.toLowerCase()} badge-category`;
    } else {
      dom.viewCategoryBadge.hidden = true;
    }
  }
}

function renderTaskList() {
  const now = new Date();
  const visible = applyFilters(state.tasks, {
    status:   state.filter,
    category: state.category,
    search:   state.search,
    sortBy:   state.sortBy,
  }, now);

  const countText = `${visible.length} ${visible.length === 1 ? 'task' : 'tasks'}`;
  setText(dom.taskCount, countText);

  dom.taskList.replaceChildren();

  if (visible.length === 0) {
    dom.emptyState.style.display = 'block';
    dom.taskList.style.display = 'none';
  } else {
    dom.emptyState.style.display = 'none';
    dom.taskList.style.display = 'flex';

    const frag = document.createDocumentFragment();
    for (const task of visible) {
      frag.appendChild(buildTaskCard(task, now));
    }
    dom.taskList.appendChild(frag);
  }
}

function render() {
  renderWelcomeHeader();
  renderStats();
  updateSidebarBadges();
  updateActiveSidebarLink();
  updateViewTitle();
  renderTaskList();
}

// ─── Modal Openers ───────────────────────────────────────────────────────────

function handleOpenAddModal() {
  state.editingId = null;
  resetForm();
  if (state.category && state.category !== 'all') {
    dom.fieldCategory.value = state.category;
  }
  openModal('Add New Task');
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

function wireEvents() {
  // Theme Toggle
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Mobile Navigation Drawer
  if (dom.btnMobileNav) dom.btnMobileNav.addEventListener('click', openMobileNav);
  if (dom.sidebarOverlay) dom.sidebarOverlay.addEventListener('click', closeMobileNav);

  // Add Task Buttons
  dom.btnAddTask.addEventListener('click', handleOpenAddModal);
  if (dom.btnHeaderAdd) dom.btnHeaderAdd.addEventListener('click', handleOpenAddModal);
  if (dom.btnEmptyAdd)  dom.btnEmptyAdd.addEventListener('click', handleOpenAddModal);

  // Modal Cancel & Close
  dom.modalClose.addEventListener('click', closeModal);
  dom.btnCancel.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Modal Form Submission
  dom.taskForm.addEventListener('submit', handleFormSubmit);

  // Sidebar Filter Links
  const filterLinks = [
    dom.sidebarAll,
    dom.sidebarToday,
    dom.sidebarUpcoming,
    dom.sidebarOverdue,
    dom.sidebarPending,
    dom.sidebarCompleted,
    dom.sidebarHigh,
  ];

  filterLinks.forEach((link) => {
    if (!link) return;
    link.addEventListener('click', (e) => {
      const f = e.currentTarget.getAttribute('data-filter');
      state.filter = f;
      saveFilter(f);
      persistState();

      // Sync toolbar tabs if applicable
      dom.filterTabs.forEach((tab) => {
        tab.classList.toggle('is-active', tab.getAttribute('data-filter') === f);
      });

      render();
      closeMobileNav();
    });
  });

  // Sidebar Category Links
  if (dom.sidebarCategoryLinks) {
    dom.sidebarCategoryLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const cat = e.currentTarget.getAttribute('data-category');
        state.category = cat;
        if (dom.filterCategorySelect) dom.filterCategorySelect.value = cat;
        persistState();
        render();
        closeMobileNav();
      });
    });
  }

  // Toolbar Filter Tabs
  dom.filterTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const f = e.currentTarget.getAttribute('data-filter');
      state.filter = f;
      saveFilter(f);
      persistState();

      dom.filterTabs.forEach((t) => t.classList.toggle('is-active', t === e.currentTarget));
      render();
    });
  });

  // Toolbar Category Select
  if (dom.filterCategorySelect) {
    dom.filterCategorySelect.addEventListener('change', (e) => {
      state.category = e.target.value;
      persistState();
      render();
    });
  }

  // Toolbar Sort Select
  if (dom.sortSelect) {
    dom.sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      persistState();
      render();
    });
  }

  // Search Input (debounced)
  dom.searchInput.addEventListener(
    'input',
    debounce((e) => {
      state.search = e.target.value;
      render();
    }, 200)
  );

  // Search Clear
  if (dom.searchClear) {
    dom.searchClear.addEventListener('click', () => {
      dom.searchInput.value = '';
      state.search = '';
      render();
      dom.searchInput.focus();
    });
  }

  // Confirm Modal Action
  dom.btnConfirmOk.addEventListener('click', () => closeConfirm(true));
  dom.btnConfirmCancel.addEventListener('click', () => closeConfirm(false));
  dom.confirmOverlay.addEventListener('click', (e) => {
    if (e.target === dom.confirmOverlay) closeConfirm(false);
  });

  // Settings Dialog
  if (dom.sidebarSettings) {
    dom.sidebarSettings.addEventListener('click', () => {
      closeMobileNav();
      openSettings();
    });
  }
  if (dom.settingsClose) dom.settingsClose.addEventListener('click', closeSettings);
  if (dom.settingsOverlay) {
    dom.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === dom.settingsOverlay) closeSettings();
    });
  }
  if (dom.btnThemeLight) {
    dom.btnThemeLight.addEventListener('click', () => {
      state.theme = 'light';
      applyTheme('light');
      saveTheme('light');
      persistState();
      showToast('Theme set to Light.', 'info');
    });
  }
  if (dom.btnThemeDark) {
    dom.btnThemeDark.addEventListener('click', () => {
      state.theme = 'dark';
      applyTheme('dark');
      saveTheme('dark');
      persistState();
      showToast('Theme set to Dark.', 'info');
    });
  }
  if (dom.btnExportJson) dom.btnExportJson.addEventListener('click', handleExportJSON);
  if (dom.importFileInput) dom.importFileInput.addEventListener('change', handleImportJSON);
  if (dom.btnClearCompleted) dom.btnClearCompleted.addEventListener('click', handleClearCompletedTasks);
  if (dom.btnClearAll) dom.btnClearAll.addEventListener('click', handleResetAllTasks);

  // Form Character Counters
  if (dom.fieldTitle) dom.fieldTitle.addEventListener('input', updateCharCounters);
  if (dom.fieldDescription) dom.fieldDescription.addEventListener('input', updateCharCounters);

  // Keyboard navigation & Shortcuts
  document.addEventListener('keydown', (e) => {
    const isEditingText = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
    const isAnyModalOpen =
      (dom.modalOverlay && dom.modalOverlay.classList.contains('is-open')) ||
      (dom.settingsOverlay && dom.settingsOverlay.classList.contains('is-open')) ||
      (dom.confirmOverlay && dom.confirmOverlay.classList.contains('is-open'));

    // '/' jumps focus to search
    if (e.key === '/' && !isEditingText && !isAnyModalOpen) {
      e.preventDefault();
      if (dom.searchInput) dom.searchInput.focus();
      return;
    }

    // 'n' or 'N' opens Add Task modal
    if ((e.key === 'n' || e.key === 'N') && !isEditingText && !isAnyModalOpen) {
      e.preventDefault();
      handleOpenAddModal();
      return;
    }

    // 1. Priority order for Escape: topmost dialog closes first
    if (e.key === 'Escape') {
      if (dom.confirmOverlay && dom.confirmOverlay.classList.contains('is-open')) {
        closeConfirm(false);
        return;
      }
      if (dom.settingsOverlay && dom.settingsOverlay.classList.contains('is-open')) {
        closeSettings();
        return;
      }
      if (dom.modalOverlay && dom.modalOverlay.classList.contains('is-open')) {
        closeModal();
        return;
      }
      if (dom.appSidebar && dom.appSidebar.classList.contains('is-open')) {
        closeMobileNav();
        return;
      }
    }

    // 2. Focus trapping on Tab and Shift + Tab
    if (e.key === 'Tab') {
      if (dom.confirmOverlay && dom.confirmOverlay.classList.contains('is-open')) {
        trapFocus(e, dom.confirmOverlay);
        return;
      }
      if (dom.settingsOverlay && dom.settingsOverlay.classList.contains('is-open')) {
        trapFocus(e, dom.settingsOverlay);
        return;
      }
      if (dom.modalOverlay && dom.modalOverlay.classList.contains('is-open')) {
        trapFocus(e, dom.modalOverlay);
        return;
      }
    }
  });
}

// ─── Application Bootstrap ────────────────────────────────────────────────────

function init() {
  if (!storageAvailable()) {
    showToast(
      'Storage is unavailable. Changes will be saved in memory for this session.',
      'error',
      6000
    );
  }

  // Load versioned application state
  const savedState = loadAppState();
  state.tasks    = savedState.tasks || [];
  state.theme    = savedState.preferences?.theme || 'light';
  state.filter   = savedState.preferences?.filter || 'all';
  state.category = savedState.preferences?.category || 'all';
  state.sortBy   = savedState.preferences?.sortBy || 'default';

  // Support demo / screenshot parameter query options
  const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
  if (urlParams) {
    const pTheme = urlParams.get('theme');
    if (pTheme === 'dark' || pTheme === 'light') {
      state.theme = pTheme;
    }
    if (urlParams.get('seed') === '1' && state.tasks.length === 0) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const yesterdayIso = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const futureIso = new Date(Date.now() + 259200000).toISOString().slice(0, 10);

      state.tasks = [
        createTask({ title: 'Complete Quarterly System Architecture Review', description: 'Audit microservice boundaries, evaluate latency metrics and document ADRs.', priority: 'high', category: 'Work', dueDate: todayIso }),
        createTask({ title: 'Prepare UX presentation for product team', description: 'Showcase redesign tokens, mobile navigation drawer, and interaction flows.', priority: 'medium', category: 'Study', dueDate: tomorrowIso }),
        createTask({ title: 'Review tax documentation & investment portfolio', description: 'Download 1099 statements and reconcile monthly expense statements.', priority: 'high', category: 'Finance', dueDate: yesterdayIso }),
        createTask({ title: 'Schedule annual health checkup & dental cleaning', description: 'Book appointment with Dr. Mehta for Friday afternoon.', priority: 'low', category: 'Health', dueDate: futureIso }),
        { ...createTask({ title: 'Setup GitHub branch protection and CodeQL workflow', description: 'Enforce strict status checks on main branch.', priority: 'medium', category: 'Work' }), status: 'completed', completed: true },
        { ...createTask({ title: 'Morning 5km endurance run', description: 'Track pace and heart rate metrics.', priority: 'low', category: 'Health' }), status: 'completed', completed: true },
      ];
      persistState();
    }
  }

  // Apply theme immediately
  applyTheme(state.theme);

  // Bind all event handlers
  wireEvents();

  // Initial render
  render();

  if (urlParams) {
    if (urlParams.get('modal') === 'add') {
      setTimeout(() => handleOpenAddModal(), 50);
    } else if (urlParams.get('modal') === 'settings') {
      setTimeout(() => openSettings(), 50);
    }
  }
}

// Initialize when DOM content is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
