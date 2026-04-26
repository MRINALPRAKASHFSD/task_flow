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
} from './utils.js';

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
  btnSubmit:          $('btn-submit'),
  btnCancel:          $('btn-cancel'),

  // Delete Confirmation dialog
  confirmOverlay:     $('confirm-overlay'),
  confirmMessage:     $('confirm-message'),
  btnConfirmOk:       $('btn-confirm-ok'),
  btnConfirmCancel:   $('btn-confirm-cancel'),

  // Toast notifications
  toastContainer:     $('toast-container'),
};

// ─── Theme Management ─────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  setText(dom.themeIcon, theme === 'dark' ? '☀️' : '🌙');
  dom.themeToggle.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  );
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

// ─── Confirmation Modal ───────────────────────────────────────────────────────

let _confirmResolve = null;

function showConfirm(message) {
  return new Promise((resolve) => {
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

// ─── Task Modal Dialog ────────────────────────────────────────────────────────

let lastFocusedElement = null;

function openModal(title) {
  lastFocusedElement = document.activeElement;
  setText(dom.modalTitle, title);
  dom.modalOverlay.classList.add('is-open');
  dom.modalOverlay.setAttribute('aria-hidden', 'false');
  clearFormErrors();
  dom.fieldTitle.focus();
}

function closeModal() {
  dom.modalOverlay.classList.remove('is-open');
  dom.modalOverlay.setAttribute('aria-hidden', 'true');
  resetForm();
  state.editingId = null;
  state.isSubmitting = false;
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

function resetForm() {
  dom.taskForm.reset();
  dom.fieldCategory.value = 'General';
  dom.fieldPriority.value = 'medium';
  dom.fieldDueDate.value = '';
  clearFormErrors();
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
  const priorityIcons = { low: '🟢', medium: '🟡', high: '🔴' };
  const pLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  priorityBadge.textContent = `${priorityIcons[task.priority] || ''} ${pLabel}`;
  meta.appendChild(priorityBadge);

  // Due date badge (if present)
  if (task.dueDate) {
    const dueBadge = document.createElement('span');
    const isOverdue = isTaskOverdue(task, referenceDate);
    const isToday = isTaskDueToday(task, referenceDate);

    let dueClass = 'badge-due-upcoming';
    let dueIcon = '📅';

    if (isOverdue) {
      dueClass = 'badge-due-overdue';
      dueIcon = '⚠️';
    } else if (isToday) {
      dueClass = 'badge-due-today';
      dueIcon = '⏰';
    }

    dueBadge.className = `badge ${dueClass}`;
    dueBadge.textContent = `${dueIcon} ${formatDueDate(task.dueDate, referenceDate)}`;
    meta.appendChild(dueBadge);
  }

  // Status badge
  const statusBadge = document.createElement('span');
  statusBadge.className = `badge badge-status-${isCompleted ? 'completed' : 'pending'}`;
  statusBadge.textContent = isCompleted ? '✓ Completed' : '○ Pending';
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
    dom.progressFill.setAttribute('aria-valuenow', stats.completionRate);
  }
  if (dom.progressLabel) {
    setText(dom.progressLabel, `${stats.completionRate}% complete`);
  }

  // Sidebar view badges
  const todayCount = state.tasks.filter((t) => isTaskDueToday(t, now)).length;
  const upcomingCount = state.tasks.filter((t) => isTaskUpcoming(t, now)).length;
  const overdueCount = stats.overdue || 0;

  setText(dom.sidebarBadgeAll,       state.tasks.length);
  setText(dom.sidebarBadgeToday,     todayCount);
  setText(dom.sidebarBadgeUpcoming,  upcomingCount);
  setText(dom.sidebarBadgeOverdue,   overdueCount);
  setText(dom.sidebarBadgePending,   stats.pending);
  setText(dom.sidebarBadgeCompleted, stats.completed);
  setText(dom.sidebarBadgeHigh,      stats.highPriority);

  // Category counts in sidebar
  CATEGORIES.forEach((cat) => {
    const badgeEl = $(`cat-badge-${cat}`);
    if (badgeEl) {
      const count = state.tasks.filter((t) => (t.category || 'General').toLowerCase() === cat.toLowerCase()).length;
      setText(badgeEl, count);
    }
  });

  const catAllBadge = $('cat-badge-all');
  if (catAllBadge) setText(catAllBadge, state.tasks.length);
}

function renderFilterControls() {
  // Update view filter tabs
  dom.filterTabs.forEach((tab) => {
    const isActive = tab.dataset.filter === state.filter;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-pressed', String(isActive));
  });

  // Update sidebar view links
  document.querySelectorAll('.sidebar-nav__link[data-filter]').forEach((link) => {
    const isActive = link.dataset.filter === state.filter;
    link.classList.toggle('is-active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Update sidebar category links
  dom.sidebarCategoryLinks.forEach((link) => {
    const isCatActive = (link.dataset.category || 'all') === state.category;
    link.classList.toggle('is-active', isCatActive);
  });

  // Update category select dropdown
  if (dom.filterCategorySelect) {
    dom.filterCategorySelect.value = state.category;
  }

  // Update sort dropdown
  if (dom.sortSelect) {
    dom.sortSelect.value = state.sortBy;
  }

  // Update view title and category badge in task list header
  const viewTitles = {
    all:       'All Tasks',
    today:     "Today's Tasks",
    upcoming:  'Upcoming Tasks',
    overdue:   'Overdue Tasks',
    pending:   'Pending Tasks',
    completed: 'Completed Tasks',
    high:      'High Priority Tasks',
  };
  const title = viewTitles[state.filter] || 'Tasks';
  setText(dom.viewTitle, title);

  if (dom.viewCategoryBadge) {
    if (state.category && state.category !== 'all') {
      dom.viewCategoryBadge.hidden = false;
      dom.viewCategoryBadge.className = `badge badge-cat-${state.category.toLowerCase()}`;
      dom.viewCategoryBadge.textContent = state.category;
    } else {
      dom.viewCategoryBadge.hidden = true;
    }
  }

  // Toggle search clear button
  if (dom.searchClear) {
    dom.searchClear.hidden = !state.search;
  }
}

function renderTaskList() {
  const now = new Date();
  const visible = applyFilters(state.tasks, {
    status:        state.filter,
    search:        state.search,
    category:      state.category,
    sortBy:        state.sortBy,
    referenceDate: now,
  });

  // Update task counter
  setText(
    dom.taskCount,
    visible.length === 1 ? '1 task' : `${visible.length} tasks`
  );

  // Clear current task card nodes
  while (dom.taskList.firstChild) {
    dom.taskList.removeChild(dom.taskList.firstChild);
  }

  // Handle empty state
  if (visible.length === 0) {
    dom.emptyState.hidden = false;
    const titleEl = dom.emptyState.querySelector('.empty-state__title');
    const descEl  = dom.emptyState.querySelector('.empty-state__description');

    if (state.search) {
      setText(titleEl, 'No matching tasks');
      setText(descEl, `No tasks found matching "${state.search}". Try different search terms.`);
    } else if (state.category && state.category !== 'all') {
      setText(titleEl, `No ${state.category} tasks`);
      setText(descEl, `You have no tasks in the ${state.category} category. Add one to get started.`);
    } else if (state.filter === 'today') {
      setText(titleEl, 'Nothing due today');
      setText(descEl, 'All caught up for today! Plan ahead or enjoy your day.');
    } else if (state.filter === 'upcoming') {
      setText(titleEl, 'No upcoming deadlines');
      setText(descEl, 'No tasks scheduled with upcoming due dates.');
    } else if (state.filter === 'overdue') {
      setText(titleEl, 'Zero overdue tasks!');
      setText(descEl, "Great job staying organized! You don't have any past-due tasks.");
    } else if (state.filter === 'completed') {
      setText(titleEl, 'No completed tasks yet');
      setText(descEl, 'Complete tasks by clicking their checkboxes to see them here.');
    } else if (state.filter === 'pending') {
      setText(titleEl, 'All caught up!');
      setText(descEl, 'No pending tasks left. Take a break or add new goals.');
    } else if (state.filter === 'high') {
      setText(titleEl, 'No high priority tasks');
      setText(descEl, 'There are currently no urgent pending tasks requiring immediate attention.');
    } else {
      setText(titleEl, 'No tasks yet');
      setText(descEl, 'Add your first task to get started. Plan smarter, stay organized!');
    }
    return;
  }

  dom.emptyState.hidden = true;
  const fragment = document.createDocumentFragment();
  visible.forEach((task) => fragment.appendChild(buildTaskCard(task, now)));
  dom.taskList.appendChild(fragment);
}

/** Complete render cycle. */
function render() {
  renderWelcomeHeader();
  renderStats();
  renderFilterControls();
  renderTaskList();
}

// ─── Event Listeners Setup ────────────────────────────────────────────────────

function wireEvents() {
  // Theme Toggle
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Mobile Navigation Drawer Toggle
  if (dom.btnMobileNav) {
    dom.btnMobileNav.addEventListener('click', () => {
      const isOpen = dom.appSidebar.classList.contains('is-open');
      if (isOpen) closeMobileNav();
      else openMobileNav();
    });
  }

  if (dom.sidebarOverlay) {
    dom.sidebarOverlay.addEventListener('click', closeMobileNav);
  }

  // Add Task Buttons
  dom.btnAddTask.addEventListener('click', () => {
    state.editingId = null;
    resetForm();
    openModal('Add New Task');
  });

  if (dom.btnHeaderAdd) {
    dom.btnHeaderAdd.addEventListener('click', () => {
      state.editingId = null;
      resetForm();
      openModal('Add New Task');
    });
  }

  if (dom.btnEmptyAdd) {
    dom.btnEmptyAdd.addEventListener('click', () => {
      state.editingId = null;
      resetForm();
      openModal('Add New Task');
    });
  }

  // Modal Dialog Close
  dom.modalClose.addEventListener('click', closeModal);
  dom.btnCancel.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Task Form Submit
  dom.taskForm.addEventListener('submit', handleFormSubmit);

  // Status Filter Tabs
  dom.filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      state.filter = tab.dataset.filter || 'all';
      saveFilter(state.filter);
      persistState();
      render();
    });
  });

  // Sidebar View Links
  document.querySelectorAll('.sidebar-nav__link[data-filter]').forEach((link) => {
    link.addEventListener('click', () => {
      state.filter = link.dataset.filter || 'all';
      saveFilter(state.filter);
      persistState();
      closeMobileNav();
      render();
    });
  });

  // Sidebar Category Links
  dom.sidebarCategoryLinks.forEach((link) => {
    link.addEventListener('click', () => {
      state.category = link.dataset.category || 'all';
      persistState();
      closeMobileNav();
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

  // Keyboard navigation: Escape key closes active modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dom.modalOverlay.classList.contains('is-open')) closeModal();
      if (dom.confirmOverlay.classList.contains('is-open')) closeConfirm(false);
      if (dom.appSidebar.classList.contains('is-open')) closeMobileNav();
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

  // Apply theme immediately
  applyTheme(state.theme);

  // Bind all event handlers
  wireEvents();

  // Initial render
  render();
}

// Initialize when DOM content is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
