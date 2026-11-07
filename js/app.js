/**
 * TaskFlow — app.js
 * Application controller — state coordination, DOM event wiring, dynamic rendering,
 * calendar engine, recurring tasks, analytics dashboard, smart reminders, and command palette.
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
  getLastStorageError,
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
  normaliseTags,
  normaliseSubtasks,
  normaliseNotes,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  getSubtaskProgress,
  getAllTags,
  CATEGORIES,
} from './tasks.js';

import {
  applyFilters,
  sortTasks,
  filterByTag,
  groupTasks,
  GROUP_BY_OPTIONS,
} from './filters.js';

import {
  DAYS_OF_WEEK,
  MONTH_NAMES,
  SHORT_MONTH_NAMES,
  formatCalendarDate,
  getMonthGrid,
  getWeekDays,
  getTasksForDate,
  getDayTaskSummary,
  navigateDay,
  getDayAgenda,
} from './calendar.js';

import {
  completeRecurringTask,
  formatRecurrenceLabel,
} from './recurrence.js';

import {
  filterTasksByTimeFrame,
  computeProductivityOverview,
  computeDailyCompletionTrends,
  computeCategoryAnalytics,
  computePriorityAnalytics,
  computeProductivityInsights,
  generateTrendChartSVG,
} from './analytics.js';

import {
  checkReminders,
  requestNotificationPermission,
  loadReminderPreferences,
  saveReminderPreferences,
  isDueSoon,
} from './reminders.js';

import {
  createCommandPalette,
  isPaletteTriggerEvent,
} from './palette.js';

import {
  ToastManager,
  TOAST_LIMIT,
  TOAST_DURATIONS,
} from './notifications.js';

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

const now = new Date();

const state = {
  /** @type {import('./tasks.js').Task[]} */
  tasks:        [],
  theme:        'light',
  currentView:  'tasks',     // 'tasks' | 'calendar' | 'analytics'
  filter:       'all',       // 'all' | 'today' | 'upcoming' | 'overdue' | 'pending' | 'completed' | 'high'
  category:     'all',       // 'all' | 'Work' | 'Personal' | 'Study' | 'Health' | 'Finance' | 'General'
  tagFilter:    'all',       // 'all' | string
  groupBy:      'none',      // 'none' | 'priority' | 'category' | 'dueDate' | 'status'
  sortBy:       'default',   // 'default' | 'newest' | 'oldest' | 'priority' | 'dueDate' | 'updated'
  search:       '',
  editingId:    null,        // ID of task being edited, or null when creating
  isSubmitting: false,

  // Calendar State
  calendar: {
    viewMode:     'month',   // 'month' | 'week' | 'day'
    year:         now.getFullYear(),
    month:        now.getMonth(),
    selectedDate: formatCalendarDate(now.getFullYear(), now.getMonth(), now.getDate()),
  },

  // Analytics State
  analytics: {
    timeFrame: '7d',         // '7d' | '30d' | '90d' | 'all'
  },

  // Subtasks buffer for task modal
  subtasksBuffer: [],

  // Smart Reminder preferences
  reminderPreferences: loadReminderPreferences(),
};

// ─── DOM Elements Cache ───────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const dom = {
  // Header
  themeToggle:        $('theme-toggle'),
  themeIcon:          $('theme-icon'),
  btnHeaderAdd:       $('btn-header-add'),
  btnHeaderPalette:   $('btn-header-palette'),
  btnMobileNav:       $('btn-mobile-nav'),

  // Navigation Links & Views
  navBtnTasks:        $('nav-btn-tasks'),
  navBtnCalendar:     $('nav-btn-calendar'),
  navBtnAnalytics:    $('nav-btn-analytics'),
  tasksView:          $('tasks-view'),
  calendarView:       $('calendar-view'),
  analyticsView:      $('analytics-view'),

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
  filterTabs:         document.querySelectorAll('.filter-tab[data-filter]'),
  filterCategorySelect: $('filter-category-select'),
  sortSelect:         $('sort-select'),
  groupBySelect:      $('group-by-select'),
  btnAddTask:         $('btn-add-task'),
  activeTagIndicator: $('active-tag-indicator'),
  activeTagBadge:     $('active-tag-badge'),
  btnClearTag:        $('btn-clear-tag'),

  // Task list & Views
  viewTitle:          $('view-title'),
  viewCategoryBadge:  $('view-category-badge'),
  taskCount:          $('task-count'),
  taskList:           $('task-list'),
  emptyState:         $('empty-state'),
  btnEmptyAdd:        $('btn-empty-add'),

  // Calendar DOM
  calendarTitle:      $('calendar-title'),
  btnCalPrev:         $('btn-cal-prev'),
  btnCalToday:        $('btn-cal-today'),
  btnCalNext:         $('btn-cal-next'),
  calViewModes:       document.querySelectorAll('.calendar-view-modes button'),
  calendarGridContainer: $('calendar-grid-container'),
  calendarDayDetail:  $('calendar-day-detail'),
  calDayDetailTitle:  $('cal-day-detail-title'),
  btnCalAddForDate:   $('btn-cal-add-for-date'),
  calDayDetailTasks:  $('cal-day-detail-tasks'),

  // Analytics DOM
  analyticsTimeframeTabs: document.querySelectorAll('.analytics-timeframe-tabs button'),
  analyticsStatTotal:     $('analytics-stat-total'),
  analyticsStatCompleted: $('analytics-stat-completed'),
  analyticsStatPending:   $('analytics-stat-pending'),
  analyticsStatOverdue:   $('analytics-stat-overdue'),
  analyticsStatRate:      $('analytics-stat-rate'),
  analyticsStatAvgPerDay: $('analytics-stat-avg-per-day'),
  analyticsTrendChartContainer: $('analytics-trend-chart-container'),
  analyticsInsightsContainer:   $('analytics-insights-container'),
  analyticsCategoryContainer:   $('analytics-category-container'),
  analyticsPriorityContainer:   $('analytics-priority-container'),

  // Task Modal dialog
  modalOverlay:       $('modal-overlay'),
  modalTitle:         $('modal-title'),
  modalClose:         $('modal-close'),
  taskForm:           $('task-form'),
  fieldTitle:         $('field-title'),
  fieldDescription:   $('field-description'),
  fieldPriority:      $('field-priority'),
  fieldCategory:      $('field-category'),
  fieldDueDate:       $('field-due-date'),
  fieldReminderTime:  $('field-reminder-time'),
  fieldRecurrence:    $('field-recurrence'),
  recurrenceCustomWrapper: $('recurrence-custom-wrapper'),
  fieldRecurrenceInterval: $('field-recurrence-interval'),
  fieldTags:          $('field-tags'),
  fieldNotes:         $('field-notes'),
  subtasksEditorList: $('subtasks-editor-list'),
  fieldNewSubtask:    $('field-new-subtask'),
  btnAddSubtask:      $('btn-add-subtask'),
  errorTitle:         $('error-title'),
  errorDescription:   $('error-description'),
  errorDueDate:       $('error-due-date'),
  titleCounter:       $('title-counter'),
  descCounter:        $('desc-counter'),
  notesCounter:       $('notes-counter'),
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

  // Smart Reminders Settings DOM
  settingBrowserNotifications: $('setting-browser-notifications'),
  btnRequestNotificationPerm:  $('btn-request-notification-perm'),
  settingInappAlerts:          $('setting-inapp-alerts'),
  settingDueSoonHours:         $('setting-due-soon-hours'),

  // Command Palette DOM
  paletteOverlay:     $('palette-overlay'),
  paletteInput:       $('palette-input'),
  paletteResults:     $('palette-results'),

  // Toast notifications
  toastContainer:     $('toast-container'),
};

// ─── Command Palette Controller ───────────────────────────────────────────────

let commandPalette = null;

function setupCommandPalette() {
  const commands = [
    {
      id: 'nav-dashboard',
      title: 'Go to Tasks Dashboard',
      category: 'Navigation',
      shortcut: 'G T',
      keywords: ['tasks', 'dashboard', 'home', 'todo'],
      handler: () => switchView('tasks'),
    },
    {
      id: 'nav-calendar',
      title: 'Go to Calendar View',
      category: 'Navigation',
      shortcut: 'G C',
      keywords: ['calendar', 'month', 'week', 'schedule'],
      handler: () => switchView('calendar'),
    },
    {
      id: 'nav-analytics',
      title: 'Go to Productivity Analytics',
      category: 'Navigation',
      shortcut: 'G A',
      keywords: ['analytics', 'stats', 'metrics', 'trends', 'charts'],
      handler: () => switchView('analytics'),
    },
    {
      id: 'action-create-task',
      title: 'Create New Task',
      category: 'Actions',
      shortcut: 'N',
      keywords: ['add', 'new', 'create'],
      handler: () => handleOpenAddModal(),
    },
    {
      id: 'action-focus-search',
      title: 'Search Tasks',
      category: 'Actions',
      shortcut: '/',
      keywords: ['find', 'filter', 'search'],
      handler: () => {
        switchView('tasks');
        setTimeout(() => dom.searchInput?.focus(), 50);
      },
    },
    {
      id: 'action-toggle-theme',
      title: 'Toggle Dark / Light Theme',
      category: 'Settings',
      shortcut: 'T',
      keywords: ['theme', 'dark', 'light', 'mode'],
      handler: () => toggleTheme(),
    },
    {
      id: 'action-open-settings',
      title: 'Open Settings & Backups',
      category: 'Settings',
      shortcut: 'S',
      keywords: ['settings', 'preferences', 'backup', 'export'],
      handler: () => openSettings(),
    },
    {
      id: 'filter-overdue',
      title: 'View Overdue Tasks',
      category: 'Views',
      shortcut: 'F O',
      keywords: ['overdue', 'late', 'expired'],
      handler: () => {
        state.filter = 'overdue';
        switchView('tasks');
        render();
      },
    },
    {
      id: 'filter-today',
      title: 'View Tasks Due Today',
      category: 'Views',
      shortcut: 'F T',
      keywords: ['today', 'due', 'schedule'],
      handler: () => {
        state.filter = 'today';
        switchView('tasks');
        render();
      },
    },
    {
      id: 'filter-high-priority',
      title: 'View High Priority Tasks',
      category: 'Views',
      shortcut: 'F H',
      keywords: ['high', 'urgent', 'priority'],
      handler: () => {
        state.filter = 'high';
        switchView('tasks');
        render();
      },
    },
  ];

  commandPalette = createCommandPalette({
    commands,
    onClose: () => {
      if (dom.paletteOverlay) {
        dom.paletteOverlay.classList.remove('is-open');
        dom.paletteOverlay.setAttribute('aria-hidden', 'true');
        setBackgroundInert(false);
      }
    },
  });
}

function openPalette() {
  if (!dom.paletteOverlay || !commandPalette) return;
  commandPalette.open();
  dom.paletteOverlay.classList.add('is-open');
  dom.paletteOverlay.setAttribute('aria-hidden', 'false');
  setBackgroundInert(true);
  if (dom.paletteInput) {
    dom.paletteInput.value = '';
    dom.paletteInput.focus();
  }
  renderPaletteResults();
}

function closePalette() {
  if (commandPalette) {
    commandPalette.close();
  }
}

function renderPaletteResults() {
  if (!dom.paletteResults || !commandPalette) return;
  const filtered = commandPalette.getFilteredCommands();
  const selectedIndex = commandPalette.getSelectedIndex();

  dom.paletteResults.replaceChildren();

  if (filtered.length === 0) {
    if (dom.paletteInput) dom.paletteInput.removeAttribute('aria-activedescendant');
    const empty = document.createElement('div');
    empty.className = 'palette-item text-muted';
    empty.textContent = 'No matching commands found.';
    dom.paletteResults.appendChild(empty);
    return;
  }

  // Group commands by category
  let currentCat = '';
  filtered.forEach((cmd, idx) => {
    if (cmd.category !== currentCat) {
      currentCat = cmd.category;
      const groupHeader = document.createElement('div');
      groupHeader.className = 'palette-group-title';
      groupHeader.textContent = currentCat;
      dom.paletteResults.appendChild(groupHeader);
    }

    const item = document.createElement('div');
    const isSelected = idx === selectedIndex;
    item.className = `palette-item ${isSelected ? 'is-selected' : ''}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    item.id = `palette-item-${cmd.id}`;

    if (isSelected && dom.paletteInput) {
      dom.paletteInput.setAttribute('aria-activedescendant', `palette-item-${cmd.id}`);
      try { item.scrollIntoView({ block: 'nearest' }); } catch (_e) {}
    }

    const left = document.createElement('div');
    left.className = 'palette-item__left';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'palette-item__title';
    titleSpan.textContent = cmd.title;
    left.appendChild(titleSpan);

    item.appendChild(left);

    if (cmd.shortcut) {
      const shortcutKbd = document.createElement('kbd');
      shortcutKbd.className = 'palette-item__shortcut';
      shortcutKbd.textContent = cmd.shortcut;
      item.appendChild(shortcutKbd);
    }

    item.addEventListener('click', () => {
      commandPalette.setSelectedIndex(idx);
      commandPalette.executeSelected();
    });

    dom.paletteResults.appendChild(item);
  });
}

// ─── View Switching ───────────────────────────────────────────────────────────

function switchView(viewName) {
  state.currentView = viewName;

  // Toggle visible containers
  if (dom.tasksView) {
    dom.tasksView.hidden = viewName !== 'tasks';
    dom.tasksView.classList.toggle('is-active', viewName === 'tasks');
  }
  if (dom.calendarView) {
    dom.calendarView.hidden = viewName !== 'calendar';
    dom.calendarView.classList.toggle('is-active', viewName === 'calendar');
  }
  if (dom.analyticsView) {
    dom.analyticsView.hidden = viewName !== 'analytics';
    dom.analyticsView.classList.toggle('is-active', viewName === 'analytics');
  }

  // Update primary navigation button states
  if (dom.navBtnTasks) {
    dom.navBtnTasks.classList.toggle('is-active', viewName === 'tasks');
  }
  if (dom.navBtnCalendar) {
    dom.navBtnCalendar.classList.toggle('is-active', viewName === 'calendar');
  }
  if (dom.navBtnAnalytics) {
    dom.navBtnAnalytics.classList.toggle('is-active', viewName === 'analytics');
  }

  if (viewName === 'calendar') {
    renderCalendar();
  } else if (viewName === 'analytics') {
    renderAnalytics();
  } else {
    render();
  }

  closeMobileNav();
}

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
  const saved = persistState();
  if (saved) {
    showToast(state.theme === 'dark' ? 'Dark theme enabled.' : 'Light theme enabled.', 'info');
  }
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

const toastManager = new ToastManager(null);

/**
 * Display a managed, non-blocking toast notification.
 *
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number|null} [durationMs=null]
 * @returns {HTMLElement|null}
 */
export function showToast(message, type = 'info', durationMs = null) {
  return toastManager.show(message, type, durationMs);
}

// ─── State Persistence ────────────────────────────────────────────────────────

let lastPersistenceWarningTime = 0;
const PERSISTENCE_WARNING_THROTTLE_MS = 10000;

function persistState() {
  const success = saveAppState({
    version: 1,
    tasks: state.tasks,
    preferences: {
      theme:    state.theme,
      filter:   state.filter,
      category: state.category,
      sortBy:   state.sortBy,
    },
  });

  if (!success) {
    const err = getLastStorageError();
    const now = Date.now();
    if (now - lastPersistenceWarningTime > PERSISTENCE_WARNING_THROTTLE_MS) {
      lastPersistenceWarningTime = now;
      const isQuota = err?.type === 'quota';
      const msg = isQuota
        ? 'Warning: Storage quota exceeded. Your changes cannot be saved to disk.'
        : 'Warning: Failed to save changes to local storage.';
      showToast(msg, 'error');
    }
    return false;
  }
  return true;
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
      (dom.confirmOverlay && dom.confirmOverlay.classList.contains('is-open')) ||
      (dom.paletteOverlay && dom.paletteOverlay.classList.contains('is-open'));
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

  // Sync reminder preferences
  if (dom.settingBrowserNotifications) {
    dom.settingBrowserNotifications.checked = state.reminderPreferences.browserNotifications;
  }
  if (dom.settingInappAlerts) {
    dom.settingInappAlerts.checked = state.reminderPreferences.inAppAlerts;
  }
  if (dom.settingDueSoonHours) {
    dom.settingDueSoonHours.value = String(state.reminderPreferences.dueSoonHours);
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
  const saved = persistState();
  render();
  closeSettings();
  if (saved) {
    showToast(`Cleared ${completedCount} completed task(s).`, 'success');
  }
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
  const saved = persistState();
  render();
  closeSettings();
  if (saved) {
    showToast('All tasks have been reset.', 'info');
  }
}

// ─── Task Modal Dialog, Counters & Subtask Editor ─────────────────────────────

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
  if (dom.notesCounter && dom.fieldNotes) {
    const nLen = dom.fieldNotes.value.length;
    dom.notesCounter.textContent = `${nLen} / 5000`;
    dom.notesCounter.classList.toggle('is-limit', nLen >= 4900);
  }
}

function renderSubtasksEditor() {
  if (!dom.subtasksEditorList) return;
  dom.subtasksEditorList.replaceChildren();

  state.subtasksBuffer.forEach((sub, idx) => {
    const item = document.createElement('div');
    item.className = 'subtask-editor-item';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = sub.completed;
    check.addEventListener('change', () => {
      sub.completed = check.checked;
    });

    const titleSpan = document.createElement('span');
    titleSpan.className = 'subtask-editor-item__title';
    titleSpan.textContent = sub.title;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-icon text-muted';
    delBtn.textContent = '✕';
    delBtn.setAttribute('aria-label', `Remove subtask: ${sub.title}`);
    delBtn.addEventListener('click', () => {
      state.subtasksBuffer.splice(idx, 1);
      renderSubtasksEditor();
    });

    item.appendChild(check);
    item.appendChild(titleSpan);
    item.appendChild(delBtn);
    dom.subtasksEditorList.appendChild(item);
  });
}

function openModal(title) {
  modalInvokingElement = document.activeElement;
  setText(dom.modalTitle, title);
  dom.modalOverlay.classList.add('is-open');
  dom.modalOverlay.setAttribute('aria-hidden', 'false');
  setBackgroundInert(true);
  clearFormErrors();
  updateCharCounters();
  renderSubtasksEditor();
  dom.fieldTitle.focus();
}

function closeModal() {
  dom.modalOverlay.classList.remove('is-open');
  dom.modalOverlay.setAttribute('aria-hidden', 'true');
  setBackgroundInert(false);
  resetForm();
  state.editingId = null;
  state.subtasksBuffer = [];
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
  if (dom.fieldReminderTime) dom.fieldReminderTime.value = '';
  if (dom.fieldRecurrence) dom.fieldRecurrence.value = 'none';
  if (dom.recurrenceCustomWrapper) dom.recurrenceCustomWrapper.hidden = true;
  if (dom.fieldRecurrenceInterval) dom.fieldRecurrenceInterval.value = '1';
  if (dom.fieldTags) dom.fieldTags.value = '';
  if (dom.fieldNotes) dom.fieldNotes.value = '';
  state.subtasksBuffer = [];
  clearFormErrors();
  updateCharCounters();
  renderSubtasksEditor();
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

  const recurrenceValue = dom.fieldRecurrence?.value || 'none';
  let recurrence = null;
  if (recurrenceValue !== 'none') {
    const interval = recurrenceValue === 'custom'
      ? Math.max(1, parseInt(dom.fieldRecurrenceInterval?.value || '1', 10))
      : 1;
    recurrence = { type: recurrenceValue, interval };
  }

  const input = {
    title:        dom.fieldTitle.value,
    description:  dom.fieldDescription.value,
    priority:     dom.fieldPriority.value,
    category:     dom.fieldCategory.value,
    dueDate:      dom.fieldDueDate.value || null,
    reminderTime: dom.fieldReminderTime?.value || null,
    recurrence,
    tags:         normaliseTags(dom.fieldTags?.value || ''),
    subtasks:     [...state.subtasksBuffer],
    notes:        normaliseNotes(dom.fieldNotes?.value || ''),
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
    const isEdit = Boolean(state.editingId);
    if (state.editingId) {
      // Edit existing task
      const existing = findTaskById(state.tasks, state.editingId);
      if (!existing) throw new Error('Task not found.');

      const updated = updateTask(existing, input);
      state.tasks = replaceTask(state.tasks, updated);
    } else {
      // Create new task
      const task = createTask(input);
      state.tasks = addTask(state.tasks, task);
    }

    const saved = persistState();
    closeModal();
    if (state.currentView === 'calendar') {
      renderCalendar();
    } else if (state.currentView === 'analytics') {
      renderAnalytics();
    } else {
      render();
    }
    if (saved) {
      showToast(isEdit ? 'Task updated successfully.' : 'Task created successfully.', 'success');
    }
  } catch (err) {
    showToast(err.message || 'An error occurred while saving the task.', 'error');
  } finally {
    state.isSubmitting = false;
  }
}

// ─── Task Actions & Recurrence Trigger ────────────────────────────────────────

function handleToggleStatus(taskId) {
  const task = findTaskById(state.tasks, taskId);
  if (!task) return;

  const isCompleting = task.status !== 'completed' && !task.completed;
  let nextTaskToInsert = null;
  let successMsg = '';

  if (isCompleting && task.recurrence) {
    // Deterministic recurrence completion engine
    const { completedTask, nextTask } = completeRecurringTask(task, new Date());
    state.tasks = replaceTask(state.tasks, completedTask);

    if (nextTask) {
      // Prevent duplicate occurrences
      const existingNext = state.tasks.find(
        t => t.title === nextTask.title && t.dueDate === nextTask.dueDate && (t.status === 'pending' || !t.completed)
      );
      if (!existingNext) {
        state.tasks = addTask(state.tasks, nextTask);
        nextTaskToInsert = nextTask;
        successMsg = `Task completed! Next recurrence scheduled for ${nextTask.dueDate}.`;
      } else {
        successMsg = 'Task completed.';
      }
    } else {
      successMsg = 'Task completed.';
    }
  } else {
    const toggled = toggleTaskStatus(task);
    state.tasks = replaceTask(state.tasks, toggled);
    successMsg = (toggled.status === 'completed' || toggled.completed)
      ? 'Task marked as completed.'
      : 'Task reopened.';
  }

  const saved = persistState();
  if (state.currentView === 'calendar') {
    renderCalendar();
  } else if (state.currentView === 'analytics') {
    renderAnalytics();
  } else {
    updateTaskListAfterToggle(taskId, nextTaskToInsert);
  }

  if (saved && successMsg) {
    showToast(successMsg, 'success');
  }
}

/**
 * Perform a targeted in-place DOM update when toggling a single task's status.
 * Avoids destroying and re-allocating the entire task list DOM tree.
 *
 * @param {string} taskId
 * @param {import('./tasks.js').Task|null} [nextTaskToInsert]
 */
function updateTaskListAfterToggle(taskId, nextTaskToInsert = null) {
  // If a recurring occurrence was spawned, use full render to ensure the new task
  // is placed at its exact sorted and filtered position without duplicate cards.
  if (nextTaskToInsert) {
    const wasFocused = dom.taskList?.querySelector(`[data-task-id="${taskId}"]`)?.contains(document.activeElement);
    render();
    if (wasFocused) {
      const targetCard = dom.taskList?.querySelector(`[data-task-id="${taskId}"]`)
        || dom.taskList?.querySelector(`[data-task-id="${nextTaskToInsert.id}"]`);
      const targetFocus = targetCard?.querySelector('.task-card__checkbox') || dom.btnAddTask;
      if (targetFocus && typeof targetFocus.focus === 'function') {
        targetFocus.focus();
      }
    }
    return;
  }

  // If complex grouping or search query is active, fall back to full render
  if (state.search || (state.groupBy && state.groupBy !== 'none')) {
    render();
    return;
  }

  const updatedTask = findTaskById(state.tasks, taskId);
  if (!updatedTask || !dom.taskList) {
    render();
    return;
  }

  const card = dom.taskList.querySelector(`[data-task-id="${taskId}"]`);
  if (!card) {
    render();
    return;
  }


  // Evaluate whether the toggled task still qualifies for display under current filter settings
  const matchesFilter = applyFilters([updatedTask], {
    status:   state.filter,
    category: state.category,
    tag:      state.tagFilter,
    search:   state.search,
    sortBy:   state.sortBy,
  }).length > 0;

  if (matchesFilter) {
    // Check if active sort order depends on completion status or update timestamp
    const isOrderInvariant = state.sortBy === 'newest' || state.sortBy === 'oldest';
    if (!isOrderInvariant) {
      const wasFocused = card.contains(document.activeElement);
      render();
      if (wasFocused) {
        const newCard = dom.taskList?.querySelector(`[data-task-id="${taskId}"]`);
        const newCheckbox = newCard?.querySelector('.task-card__checkbox');
        if (newCheckbox && typeof newCheckbox.focus === 'function') {
          newCheckbox.focus();
        }
      }
      return;
    }

    // In-place DOM update: mutate existing card without tearing down other tasks
    const isCompleted = updatedTask.status === 'completed' || Boolean(updatedTask.completed);
    card.classList.toggle('is-completed', isCompleted);

    const checkbox = card.querySelector('.task-card__checkbox');
    if (checkbox) {
      checkbox.checked = isCompleted;
      checkbox.setAttribute('aria-label', isCompleted ? 'Reopen task' : 'Mark task completed');
    }

    const statusBadge = card.querySelector('.badge-status-completed, .badge-status-pending');
    if (statusBadge) {
      statusBadge.className = `badge badge-status-${isCompleted ? 'completed' : 'pending'}`;
      statusBadge.replaceChildren();
      if (isCompleted) {
        const checkSvg = createCheckIcon(12);
        if (checkSvg) statusBadge.appendChild(checkSvg);
        statusBadge.appendChild(document.createTextNode(' Completed'));
      } else {
        statusBadge.textContent = '○ Pending';
      }
    }
  } else {
    // Task no longer satisfies active filter (e.g., completed while viewing 'pending')
    // Preserve keyboard focus if the user was focused within this card before removal
    const wasFocused = card.contains(document.activeElement);
    const fallbackFocus = card.nextElementSibling?.querySelector('.task-card__checkbox')
      || card.previousElementSibling?.querySelector('.task-card__checkbox')
      || dom.btnAddTask;

    card.remove();

    if (wasFocused && fallbackFocus && typeof fallbackFocus.focus === 'function') {
      fallbackFocus.focus();
    }
  }

  // Synchronize counts, overview stats, and sidebar indicators
  const visibleCards = dom.taskList.querySelectorAll('.task-card');
  const count = visibleCards.length;
  setText(dom.taskCount, `${count} ${count === 1 ? 'task' : 'tasks'}`);

  if (count === 0) {
    dom.taskList.style.display = 'none';
    dom.emptyState.style.display = 'block';
  } else {
    dom.taskList.style.display = 'flex';
    dom.emptyState.style.display = 'none';
  }

  renderStats();
  updateSidebarBadges();
}

async function handleDeleteTask(taskId) {
  const task = findTaskById(state.tasks, taskId);
  if (!task) return;

  const confirmed = await showConfirm(`Are you sure you want to delete "${task.title}"? This cannot be undone.`);
  if (!confirmed) return;

  state.tasks = deleteTask(state.tasks, taskId);
  const saved = persistState();
  if (state.currentView === 'calendar') {
    renderCalendar();
  } else if (state.currentView === 'analytics') {
    renderAnalytics();
  } else {
    render();
  }
  if (saved) {
    showToast('Task deleted.', 'info');
  }
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

  if (dom.fieldReminderTime) dom.fieldReminderTime.value = task.reminderTime || '';
  if (dom.fieldRecurrence)   dom.fieldRecurrence.value   = task.recurrence?.type || 'none';
  if (dom.recurrenceCustomWrapper) {
    dom.recurrenceCustomWrapper.hidden = task.recurrence?.type !== 'custom';
    if (dom.fieldRecurrenceInterval) {
      dom.fieldRecurrenceInterval.value = String(task.recurrence?.interval || 1);
    }
  }
  if (dom.fieldTags)         dom.fieldTags.value         = Array.isArray(task.tags) ? task.tags.join(', ') : '';
  if (dom.fieldNotes)        dom.fieldNotes.value        = task.notes || '';

  state.subtasksBuffer = Array.isArray(task.subtasks) ? task.subtasks.map(s => ({ ...s })) : [];

  openModal('Edit Task');
}

function handleToggleSubtask(taskId, subtaskId) {
  const task = findTaskById(state.tasks, taskId);
  if (!task) return;

  const updated = toggleSubtask(task, subtaskId);
  state.tasks = replaceTask(state.tasks, updated);
  persistState();
  renderTaskList();
}

// ─── DOM Card Builder with Tags, Subtasks & Recurrence ────────────────────────

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

  // Tags row
  if (Array.isArray(task.tags) && task.tags.length > 0) {
    const tagsWrapper = document.createElement('div');
    tagsWrapper.className = 'task-card__tags';
    task.tags.forEach(tag => {
      const tagBtn = document.createElement('button');
      tagBtn.type = 'button';
      tagBtn.className = 'task-tag';
      tagBtn.textContent = `#${tag}`;
      tagBtn.setAttribute('aria-label', `Filter by tag ${tag}`);
      tagBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.tagFilter = tag;
        render();
      });
      tagsWrapper.appendChild(tagBtn);
    });
    body.appendChild(tagsWrapper);
  }

  // Subtasks progress and checklist
  if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
    const progress = getSubtaskProgress(task);
    const subtasksWrapper = document.createElement('div');
    subtasksWrapper.className = 'task-card__subtasks';

    const progLabel = document.createElement('span');
    progLabel.className = 'text-xs text-muted task-subtasks-summary';
    progLabel.textContent = `Steps: ${progress.completed}/${progress.total} (${progress.percentage}%)`;
    subtasksWrapper.appendChild(progLabel);

    task.subtasks.forEach(sub => {
      const subItem = document.createElement('label');
      subItem.className = `subtask-checklist-item ${sub.completed ? 'is-completed' : ''}`;

      const subCheck = document.createElement('input');
      subCheck.type = 'checkbox';
      subCheck.className = 'subtask-checkbox form-checkbox';
      subCheck.checked = sub.completed;
      subCheck.addEventListener('change', (e) => {
        e.stopPropagation();
        handleToggleSubtask(task.id, sub.id);
      });

      const subText = document.createElement('span');
      subText.textContent = sub.title;

      subItem.appendChild(subCheck);
      subItem.appendChild(subText);
      subtasksWrapper.appendChild(subItem);
    });

    body.appendChild(subtasksWrapper);
  }

  // Task Notes (collapsible)
  if (task.notes) {
    const notesToggle = document.createElement('button');
    notesToggle.type = 'button';
    notesToggle.className = 'task-notes-toggle';
    notesToggle.textContent = '📝 View Notes';

    const notesBody = document.createElement('div');
    notesBody.className = 'task-notes-body';
    notesBody.textContent = task.notes;
    notesBody.hidden = true;

    notesToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      notesBody.hidden = !notesBody.hidden;
      notesToggle.textContent = notesBody.hidden ? '📝 View Notes' : '📝 Hide Notes';
    });

    body.appendChild(notesToggle);
    body.appendChild(notesBody);
  }

  // Meta row (Priority, Category, Due date, Recurrence, Due Soon, Status)
  const meta = document.createElement('div');
  meta.className = 'task-card__meta';

  // Priority indicator
  const prioSpan = document.createElement('span');
  prioSpan.className = `task-card__priority badge-priority-${task.priority || 'medium'}`;
  const dot = createPriorityDot(task.priority || 'medium');
  if (dot) prioSpan.appendChild(dot);
  prioSpan.appendChild(
    document.createTextNode(
      (task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1)
    )
  );
  meta.appendChild(prioSpan);

  // Category badge
  const catBadge = document.createElement('span');
  catBadge.className = `badge badge-cat-${(task.category || 'General').toLowerCase()}`;
  catBadge.textContent = task.category || 'General';
  meta.appendChild(catBadge);

  // Due Date & Due-Soon Badge
  if (task.dueDate) {
    const dueSpan = document.createElement('span');
    const isOverdue = isTaskOverdue(task, referenceDate);
    const isToday = isTaskDueToday(task, referenceDate);

    dueSpan.className = [
      'task-card__due',
      isOverdue ? 'task-card__due--overdue' : '',
      isToday ? 'task-card__due--today' : '',
    ].join(' ').trim();

    const calSvg = isOverdue ? createAlertIcon(13) : createCalendarIcon(13);
    if (calSvg) dueSpan.appendChild(calSvg);
    dueSpan.appendChild(document.createTextNode(formatDueDate(task.dueDate)));
    meta.appendChild(dueSpan);

    if (isDueSoon(task, referenceDate, state.reminderPreferences.dueSoonHours)) {
      const soonBadge = document.createElement('span');
      soonBadge.className = 'badge-due-soon';
      soonBadge.textContent = 'Due Soon';
      meta.appendChild(soonBadge);
    }
  }

  // Recurrence badge
  if (task.recurrence) {
    const recBadge = document.createElement('span');
    recBadge.className = 'badge-recurrence';
    recBadge.textContent = `↻ ${formatRecurrenceLabel(task.recurrence)}`;
    meta.appendChild(recBadge);
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

function buildDayAgendaTaskCard(task) {
  const card = document.createElement('div');
  card.className = `day-agenda-task-card ${task.status === 'completed' || task.completed ? 'is-completed' : ''}`;
  card.setAttribute('role', 'listitem');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'task-card__checkbox form-checkbox';
  check.checked = task.status === 'completed' || Boolean(task.completed);
  check.setAttribute('aria-label', `Mark task "${task.title}" as ${check.checked ? 'pending' : 'completed'}`);
  check.addEventListener('click', (e) => {
    e.stopPropagation();
    handleToggleStatus(task.id);
  });
  card.appendChild(check);

  const infoCol = document.createElement('div');
  infoCol.className = 'day-agenda-task-info';

  const titleRow = document.createElement('div');
  titleRow.className = 'day-agenda-task-title-row';

  const dot = createPriorityDot(task.priority || 'medium');
  if (dot) titleRow.appendChild(dot);

  const titleSpan = document.createElement('span');
  titleSpan.className = 'day-agenda-task-title';
  titleSpan.textContent = task.title;
  titleRow.appendChild(titleSpan);
  infoCol.appendChild(titleRow);

  const metaRow = document.createElement('div');
  metaRow.className = 'day-agenda-task-meta';

  const catBadge = document.createElement('span');
  catBadge.className = `badge badge-cat-${(task.category || 'general').toLowerCase()}`;
  catBadge.textContent = task.category || 'General';
  metaRow.appendChild(catBadge);

  const prioBadge = document.createElement('span');
  prioBadge.className = `badge badge-priority-${task.priority || 'medium'}`;
  prioBadge.textContent = (task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1);
  metaRow.appendChild(prioBadge);

  if (task.reminderTime) {
    const timeBadge = document.createElement('span');
    timeBadge.className = 'badge badge-reminder-time';
    timeBadge.textContent = `⏰ ${task.reminderTime}`;
    metaRow.appendChild(timeBadge);
  }

  if (task.recurrence && task.recurrence.type !== 'none') {
    const recBadge = document.createElement('span');
    recBadge.className = 'badge badge-recurrence';
    recBadge.textContent = `🔁 ${formatRecurrenceLabel(task.recurrence)}`;
    metaRow.appendChild(recBadge);
  }

  infoCol.appendChild(metaRow);
  card.appendChild(infoCol);

  const actions = document.createElement('div');
  actions.className = 'day-agenda-task-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'task-action-btn task-action-btn--edit';
  editBtn.setAttribute('aria-label', `Edit "${task.title}"`);
  editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleEditTask(task.id);
  });
  actions.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'task-action-btn task-action-btn--delete';
  delBtn.setAttribute('aria-label', `Delete "${task.title}"`);
  delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteTask(task.id);
  });
  actions.appendChild(delBtn);

  card.appendChild(actions);
  return card;
}

// ─── Calendar View Rendering ──────────────────────────────────────────────────

function renderCalendar() {
  if (!dom.calendarGridContainer) return;
  const { year, month, selectedDate, viewMode } = state.calendar;

  // Title update
  if (dom.calendarTitle) {
    if (viewMode === 'day') {
      const agenda = getDayAgenda(selectedDate, state.tasks);
      dom.calendarTitle.textContent = `${agenda.dayFullName}, ${agenda.monthName} ${agenda.dayNumber}, ${agenda.year}`;
    } else if (viewMode === 'week') {
      const weekDays = getWeekDays(selectedDate);
      const start = weekDays[0];
      const end = weekDays[6];
      if (start.month === end.month) {
        dom.calendarTitle.textContent = `${MONTH_NAMES[start.month]} ${start.dayNumber} – ${end.dayNumber}, ${start.year}`;
      } else {
        dom.calendarTitle.textContent = `${SHORT_MONTH_NAMES[start.month]} ${start.dayNumber} – ${SHORT_MONTH_NAMES[end.month]} ${end.dayNumber}, ${end.year}`;
      }
    } else {
      dom.calendarTitle.textContent = `${MONTH_NAMES[month]} ${year}`;
    }
  }

  // View modes button state
  dom.calViewModes.forEach(btn => {
    const mode = btn.getAttribute('data-cal-view');
    btn.classList.toggle('is-active', mode === viewMode);
    btn.setAttribute('aria-pressed', mode === viewMode ? 'true' : 'false');
  });

  dom.calendarGridContainer.replaceChildren();

  if (viewMode === 'day') {
    const agenda = getDayAgenda(selectedDate, state.tasks);
    const dayWrapper = document.createElement('div');
    dayWrapper.id = 'calendar-grid-day';
    dayWrapper.className = 'calendar-day-agenda';
    dayWrapper.setAttribute('role', 'region');
    dayWrapper.setAttribute('aria-label', `Day agenda for ${agenda.dayFullName}, ${agenda.monthName} ${agenda.dayNumber}`);

    // 1. Header summary banner
    const headerBanner = document.createElement('div');
    headerBanner.className = 'day-agenda-header';

    const headerTitleCol = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.className = 'day-agenda-title';
    h3.textContent = `${agenda.dayFullName}, ${agenda.monthName} ${agenda.dayNumber}, ${agenda.year}`;
    headerTitleCol.appendChild(h3);

    const metaRow = document.createElement('div');
    metaRow.className = 'day-agenda-meta';
    if (agenda.isToday) {
      const todayBadge = document.createElement('span');
      todayBadge.className = 'badge badge-today';
      todayBadge.textContent = 'Today';
      metaRow.appendChild(todayBadge);
    }
    const totalBadge = document.createElement('span');
    totalBadge.className = 'badge badge-cat-general';
    totalBadge.textContent = `${agenda.summary.total} Scheduled`;
    metaRow.appendChild(totalBadge);

    const compBadge = document.createElement('span');
    compBadge.className = 'badge badge-priority-low';
    compBadge.textContent = `${agenda.summary.completed} Completed`;
    metaRow.appendChild(compBadge);

    if (agenda.summary.pending > 0) {
      const pendBadge = document.createElement('span');
      pendBadge.className = 'badge badge-priority-medium';
      pendBadge.textContent = `${agenda.summary.pending} Pending`;
      metaRow.appendChild(pendBadge);
    }
    headerTitleCol.appendChild(metaRow);
    headerBanner.appendChild(headerTitleCol);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.id = 'btn-day-add-task';
    addBtn.innerHTML = `<span>+ Add Task</span>`;
    addBtn.addEventListener('click', () => handleOpenAddModal(agenda.dateString));
    headerBanner.appendChild(addBtn);

    dayWrapper.appendChild(headerBanner);

    // 2. Overdue Alert Section (if any overdue tasks)
    if (agenda.overdueTasks.length > 0) {
      const overdueSection = document.createElement('div');
      overdueSection.className = 'day-agenda-section day-agenda-section--overdue';

      const secHeader = document.createElement('h4');
      secHeader.className = 'day-agenda-section-title text-danger';
      secHeader.textContent = `⚠️ Overdue from Previous Days (${agenda.overdueTasks.length})`;
      overdueSection.appendChild(secHeader);

      const overdueList = document.createElement('div');
      overdueList.className = 'day-agenda-task-list';
      agenda.overdueTasks.forEach(task => {
        overdueList.appendChild(buildDayAgendaTaskCard(task));
      });
      overdueSection.appendChild(overdueList);
      dayWrapper.appendChild(overdueSection);
    }

    // 3. All-Day / Scheduled Tasks Section
    const allDaySection = document.createElement('div');
    allDaySection.className = 'day-agenda-section';

    const allDayHeader = document.createElement('h4');
    allDayHeader.className = 'day-agenda-section-title';
    allDayHeader.textContent = `📅 All-Day & Scheduled Tasks (${agenda.allDayTasks.length})`;
    allDaySection.appendChild(allDayHeader);

    if (agenda.allDayTasks.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.className = 'text-muted text-xs';
      emptyP.textContent = 'No all-day tasks scheduled for this date.';
      allDaySection.appendChild(emptyP);
    } else {
      const allDayList = document.createElement('div');
      allDayList.className = 'day-agenda-task-list';
      agenda.allDayTasks.forEach(task => {
        allDayList.appendChild(buildDayAgendaTaskCard(task));
      });
      allDaySection.appendChild(allDayList);
    }
    dayWrapper.appendChild(allDaySection);

    // 4. Hourly Timeline
    const timelineSection = document.createElement('div');
    timelineSection.className = 'day-agenda-section';

    const timeHeader = document.createElement('h4');
    timeHeader.className = 'day-agenda-section-title';
    timeHeader.textContent = `⏰ Hourly Schedule (${agenda.timedTasks.length} timed)`;
    timelineSection.appendChild(timeHeader);

    const timelineContainer = document.createElement('div');
    timelineContainer.className = 'day-agenda-timeline';

    agenda.hourlySlots.forEach(slot => {
      const hasTasks = slot.tasks.length > 0;
      const isWorkingHour = slot.hour >= 7 && slot.hour <= 20;
      if (!hasTasks && !isWorkingHour) return;

      const row = document.createElement('div');
      row.className = `agenda-hour-row ${hasTasks ? 'has-tasks' : ''}`;

      const timeCol = document.createElement('div');
      timeCol.className = 'agenda-hour-time';
      timeCol.textContent = slot.label;
      row.appendChild(timeCol);

      const contentCol = document.createElement('div');
      contentCol.className = 'agenda-hour-content';

      if (hasTasks) {
        slot.tasks.forEach(task => {
          contentCol.appendChild(buildDayAgendaTaskCard(task));
        });
      } else {
        const addSlotBtn = document.createElement('button');
        addSlotBtn.type = 'button';
        addSlotBtn.className = 'agenda-empty-slot';
        addSlotBtn.textContent = `+ Add at ${slot.label}`;
        addSlotBtn.setAttribute('aria-label', `Add task for ${slot.label}`);
        addSlotBtn.addEventListener('click', () => {
          handleOpenAddModal(agenda.dateString);
          if (dom.fieldReminderTime) dom.fieldReminderTime.value = slot.timeString;
        });
        contentCol.appendChild(addSlotBtn);
      }
      row.appendChild(contentCol);
      timelineContainer.appendChild(row);
    });

    timelineSection.appendChild(timelineContainer);
    dayWrapper.appendChild(timelineSection);

    dom.calendarGridContainer.appendChild(dayWrapper);
  } else if (viewMode === 'week') {
    // Dedicated 7-day weekly layout
    const weekWrapper = document.createElement('div');
    weekWrapper.id = 'calendar-grid-week';
    weekWrapper.className = 'calendar-grid calendar-grid--week';

    const weekDays = getWeekDays(selectedDate);
    // Weekday column headers
    weekDays.forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-weekday';
      dayHeader.textContent = `${day.dayName} ${day.dayNumber}`;
      weekWrapper.appendChild(dayHeader);
    });

    weekDays.forEach(day => {
      const cell = document.createElement('div');
      cell.className = [
        'calendar-day-cell',
        'calendar-day-cell--week',
        day.isToday ? 'is-today' : '',
        day.dateString === selectedDate ? 'is-selected' : '',
      ].join(' ').trim();

      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `${day.dayFullName}, ${day.dateString}`);

      const header = document.createElement('div');
      header.className = 'calendar-day-header';

      const numSpan = document.createElement('span');
      numSpan.className = 'calendar-day-number';
      numSpan.textContent = String(day.dayNumber);
      header.appendChild(numSpan);

      const dayTasks = getTasksForDate(state.tasks, day.dateString);
      const summary = getDayTaskSummary(dayTasks, new Date());

      if (summary.total > 0) {
        const badge = document.createElement('span');
        badge.className = `calendar-day-badge ${summary.overdue > 0 ? 'calendar-day-badge--overdue' : ''}`;
        badge.textContent = `${summary.completed}/${summary.total}`;
        header.appendChild(badge);
      }

      cell.appendChild(header);

      if (dayTasks.length > 0) {
        const pillContainer = document.createElement('div');
        pillContainer.className = 'calendar-day-tasks';
        dayTasks.forEach(t => {
          const pill = document.createElement('div');
          pill.className = `calendar-task-pill ${t.status === 'completed' || t.completed ? 'is-completed' : ''} ${t.priority === 'high' ? 'calendar-task-pill--high' : ''}`;
          pill.textContent = t.title;
          pillContainer.appendChild(pill);
        });
        cell.appendChild(pillContainer);
      }

      cell.addEventListener('click', () => {
        state.calendar.selectedDate = day.dateString;
        renderCalendar();
      });

      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          state.calendar.selectedDate = day.dateString;
          renderCalendar();
        }
      });

      weekWrapper.appendChild(cell);
    });

    dom.calendarGridContainer.appendChild(weekWrapper);
  } else {
    // Month Grid
    const gridWrapper = document.createElement('div');
    gridWrapper.id = 'calendar-grid-month';
    gridWrapper.className = 'calendar-grid';

    // Weekday column headers
    DAYS_OF_WEEK.forEach(dayName => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-weekday';
      dayHeader.textContent = dayName;
      gridWrapper.appendChild(dayHeader);
    });

    // Calculate grid slots
    const slots = getMonthGrid(year, month);
    slots.forEach(slot => {
      const cell = document.createElement('div');
      cell.className = [
        'calendar-day-cell',
        slot.isCurrentMonth ? '' : 'is-other-month',
        slot.isToday ? 'is-today' : '',
        slot.dateString === selectedDate ? 'is-selected' : '',
      ].join(' ').trim();

      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `${slot.dateString}`);

      const header = document.createElement('div');
      header.className = 'calendar-day-header';

      const numSpan = document.createElement('span');
      numSpan.className = 'calendar-day-number';
      numSpan.textContent = String(slot.dayNumber || slot.day || '');
      header.appendChild(numSpan);

      const dayTasks = getTasksForDate(state.tasks, slot.dateString);
      const summary = getDayTaskSummary(dayTasks, new Date());

      if (summary.total > 0) {
        const badge = document.createElement('span');
        badge.className = `calendar-day-badge ${summary.overdue > 0 ? 'calendar-day-badge--overdue' : ''}`;
        badge.textContent = `${summary.completed}/${summary.total}`;
        header.appendChild(badge);
      }

      cell.appendChild(header);

      // Render task pills inside day cell
      if (dayTasks.length > 0) {
        const pillContainer = document.createElement('div');
        pillContainer.className = 'calendar-day-tasks';
        dayTasks.slice(0, 3).forEach(t => {
          const pill = document.createElement('div');
          pill.className = `calendar-task-pill ${t.status === 'completed' || t.completed ? 'is-completed' : ''} ${t.priority === 'high' ? 'calendar-task-pill--high' : ''}`;
          pill.textContent = t.title;
          pillContainer.appendChild(pill);
        });
        if (dayTasks.length > 3) {
          const more = document.createElement('div');
          more.className = 'text-xs text-muted';
          more.textContent = `+${dayTasks.length - 3} more`;
          pillContainer.appendChild(more);
        }
        cell.appendChild(pillContainer);
      }

      cell.addEventListener('click', () => {
        state.calendar.selectedDate = slot.dateString;
        renderCalendar();
      });

      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          state.calendar.selectedDate = slot.dateString;
          renderCalendar();
        }
      });

      gridWrapper.appendChild(cell);
    });

    dom.calendarGridContainer.appendChild(gridWrapper);
  }

  renderCalendarDayDetail();
}

function renderCalendarDayDetail() {
  if (dom.calendarDayDetail) {
    dom.calendarDayDetail.hidden = (state.calendar.viewMode === 'day');
  }
  if (!dom.calDayDetailTasks || !dom.calDayDetailTitle) return;
  const { selectedDate } = state.calendar;

  dom.calDayDetailTitle.textContent = `Tasks for ${selectedDate}`;
  dom.calDayDetailTasks.replaceChildren();

  const dayTasks = getTasksForDate(state.tasks, selectedDate);
  if (dayTasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-muted text-sm';
    empty.textContent = 'No tasks scheduled for this day.';
    dom.calDayDetailTasks.appendChild(empty);
    return;
  }

  const now = new Date();
  dayTasks.forEach(task => {
    dom.calDayDetailTasks.appendChild(buildTaskCard(task, now));
  });
}

// ─── Analytics View Rendering ─────────────────────────────────────────────────

function renderAnalytics() {
  if (!dom.analyticsView) return;
  const { timeFrame } = state.analytics;

  // Sync timeframe tab buttons
  dom.analyticsTimeframeTabs.forEach(btn => {
    const tf = btn.getAttribute('data-timeframe');
    btn.classList.toggle('is-active', tf === timeFrame);
    btn.setAttribute('aria-pressed', tf === timeFrame ? 'true' : 'false');
  });

  const filteredTasks = filterTasksByTimeFrame(state.tasks, timeFrame);
  const overview = computeProductivityOverview(filteredTasks);

  if (dom.analyticsStatTotal)     setText(dom.analyticsStatTotal, overview.total);
  if (dom.analyticsStatCompleted) setText(dom.analyticsStatCompleted, overview.completed);
  if (dom.analyticsStatPending)   setText(dom.analyticsStatPending, overview.pending);
  if (dom.analyticsStatOverdue)   setText(dom.analyticsStatOverdue, overview.overdue);
  if (dom.analyticsStatRate)      setText(dom.analyticsStatRate, `${overview.completionRate}%`);
  if (dom.analyticsStatAvgPerDay) {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, 'all': 30 };
    const timeFrameDays = daysMap[timeFrame] || 7;
    const avg = overview.averagePerDay !== undefined ? overview.averagePerDay : Number((overview.completed / timeFrameDays).toFixed(1));
    setText(dom.analyticsStatAvgPerDay, avg);
  }

  // Completion Trend Chart (Pure SVG)
  if (dom.analyticsTrendChartContainer) {
    const trendDays = timeFrame === '7d' ? 7 : (timeFrame === '30d' ? 14 : 30);
    const trends = computeDailyCompletionTrends(state.tasks, trendDays);
    const svgString = generateTrendChartSVG(trends);
    dom.analyticsTrendChartContainer.innerHTML = svgString;
  }

  // Category Performance
  if (dom.analyticsCategoryContainer) {
    dom.analyticsCategoryContainer.replaceChildren();
    const catStats = computeCategoryAnalytics(filteredTasks);
    catStats.forEach(item => {
      const row = document.createElement('div');
      row.className = 'analytics-breakdown-row';

      const meta = document.createElement('div');
      meta.className = 'analytics-breakdown-meta';
      const labelSpan = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = item.category;
      labelSpan.appendChild(strong);
      labelSpan.appendChild(document.createTextNode(` (${item.completed}/${item.total})`));
      const rateSpan = document.createElement('span');
      const categoryRate = item.rate !== undefined ? item.rate : item.completionRate;
      rateSpan.textContent = `${categoryRate}%`;
      meta.appendChild(labelSpan);
      meta.appendChild(rateSpan);

      const bar = document.createElement('div');
      bar.className = 'analytics-breakdown-bar';
      const fill = document.createElement('div');
      fill.className = 'analytics-breakdown-fill';
      fill.style.width = `${categoryRate}%`;
      bar.appendChild(fill);

      row.appendChild(meta);
      row.appendChild(bar);
      dom.analyticsCategoryContainer.appendChild(row);
    });
  }

  // Priority Distribution
  if (dom.analyticsPriorityContainer) {
    dom.analyticsPriorityContainer.replaceChildren();
    const prioStats = computePriorityAnalytics(filteredTasks);
    const prioOrder = ['high', 'medium', 'low'];

    prioOrder.forEach(p => {
      const item = prioStats[p];
      const row = document.createElement('div');
      row.className = 'analytics-breakdown-row';

      const labelCapital = p.charAt(0).toUpperCase() + p.slice(1);
      const meta = document.createElement('div');
      meta.className = 'analytics-breakdown-meta';
      const labelSpan = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = `${labelCapital} Priority`;
      labelSpan.appendChild(strong);
      const taskCount = item.total !== undefined ? item.total : item.count;
      labelSpan.appendChild(document.createTextNode(` (${taskCount} tasks)`));
      const rateSpan = document.createElement('span');
      rateSpan.textContent = `${item.percentage}%`;
      meta.appendChild(labelSpan);
      meta.appendChild(rateSpan);

      const bar = document.createElement('div');
      bar.className = 'analytics-breakdown-bar';
      const fill = document.createElement('div');
      fill.className = 'analytics-breakdown-fill';
      fill.style.width = `${item.percentage}%`;
      if (p === 'high') fill.style.background = 'var(--color-danger)';
      if (p === 'medium') fill.style.background = 'var(--color-warning)';
      if (p === 'low') fill.style.background = 'var(--color-success)';
      bar.appendChild(fill);

      row.appendChild(meta);
      row.appendChild(bar);
      dom.analyticsPriorityContainer.appendChild(row);
    });
  }

  // Productivity Insights
  if (dom.analyticsInsightsContainer) {
    const insightText = computeProductivityInsights(state.tasks);
    dom.analyticsInsightsContainer.textContent = insightText;
  }
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

  // Update active tag chip indicator
  if (dom.activeTagIndicator && dom.activeTagBadge) {
    if (state.tagFilter && state.tagFilter !== 'all') {
      dom.activeTagIndicator.hidden = false;
      dom.activeTagBadge.textContent = `#${state.tagFilter}`;
    } else {
      dom.activeTagIndicator.hidden = true;
    }
  }
}

function renderTaskList() {
  const now = new Date();
  let visible = applyFilters(state.tasks, {
    status:   state.filter,
    category: state.category,
    tag:      state.tagFilter,
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

    if (state.groupBy && state.groupBy !== 'none') {
      const groups = groupTasks(visible, state.groupBy, now);
      groups.forEach(grp => {
        if (grp.count > 0) {
          const groupWrapper = document.createElement('div');
          groupWrapper.className = 'task-group';

          const groupHeader = document.createElement('h3');
          groupHeader.className = 'group-header';
          groupHeader.textContent = `${grp.label} (${grp.count})`;
          groupWrapper.appendChild(groupHeader);

          grp.tasks.forEach(task => {
            groupWrapper.appendChild(buildTaskCard(task, now));
          });

          frag.appendChild(groupWrapper);
        }
      });
    } else {
      for (const task of visible) {
        frag.appendChild(buildTaskCard(task, now));
      }
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

  // Synchronize clear button and keyboard hint with active search
  if (dom.searchClear) {
    dom.searchClear.hidden = !state.search;
  }
  const searchKbd = document.getElementById('search-kbd');
  if (searchKbd) {
    searchKbd.hidden = Boolean(state.search);
  }
}

// ─── Modal Openers ───────────────────────────────────────────────────────────

function handleOpenAddModal(initialDate = null) {
  state.editingId = null;
  resetForm();
  if (state.category && state.category !== 'all') {
    dom.fieldCategory.value = state.category;
  }
  if (initialDate && typeof initialDate === 'string') {
    dom.fieldDueDate.value = initialDate;
  }
  openModal('Add New Task');
}

// ─── Smart Reminders Engine ───────────────────────────────────────────────────

function triggerSmartRemindersCheck() {
  checkReminders(state.tasks, {
    preferences: state.reminderPreferences,
    onInAppNotify: (notification) => {
      showToast(notification.message, notification.type === 'overdue' ? 'error' : 'info', 5000);
    },
    onBrowserNotify: (notification) => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('TaskFlow Reminder', {
            body: notification.message,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%234f46e5"/></svg>',
          });
        } catch (_) {}
      }
    },
  });
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

function wireEvents() {
  // Theme Toggle
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Mobile Navigation Drawer
  if (dom.btnMobileNav) dom.btnMobileNav.addEventListener('click', openMobileNav);
  if (dom.sidebarOverlay) dom.sidebarOverlay.addEventListener('click', closeMobileNav);

  // Primary Navigation View Switches
  if (dom.navBtnTasks) dom.navBtnTasks.addEventListener('click', () => switchView('tasks'));
  if (dom.navBtnCalendar) dom.navBtnCalendar.addEventListener('click', () => switchView('calendar'));
  if (dom.navBtnAnalytics) dom.navBtnAnalytics.addEventListener('click', () => switchView('analytics'));

  // Command Palette Openers
  if (dom.btnHeaderPalette) dom.btnHeaderPalette.addEventListener('click', openPalette);
  if (dom.paletteOverlay) {
    dom.paletteOverlay.addEventListener('click', (e) => {
      if (e.target === dom.paletteOverlay) closePalette();
    });
  }

  if (dom.paletteInput) {
    dom.paletteInput.addEventListener('input', (e) => {
      if (commandPalette) {
        commandPalette.setQuery(e.target.value);
        renderPaletteResults();
      }
    });

    dom.paletteInput.addEventListener('keydown', (e) => {
      if (!commandPalette) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        commandPalette.selectNext();
        renderPaletteResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        commandPalette.selectPrevious();
        renderPaletteResults();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commandPalette.executeSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      }
    });
  }

  // Calendar Controls
  if (dom.btnCalPrev) {
    dom.btnCalPrev.addEventListener('click', () => {
      if (state.calendar.viewMode === 'day') {
        const next = navigateDay(state.calendar.selectedDate, -1);
        state.calendar.selectedDate = next.dateString;
        state.calendar.year = next.year;
        state.calendar.month = next.month;
      } else if (state.calendar.viewMode === 'week') {
        const cur = new Date(`${state.calendar.selectedDate}T00:00:00`);
        cur.setDate(cur.getDate() - 7);
        state.calendar.year = cur.getFullYear();
        state.calendar.month = cur.getMonth();
        state.calendar.selectedDate = formatCalendarDate(cur.getFullYear(), cur.getMonth(), cur.getDate());
      } else {
        if (state.calendar.month === 0) {
          state.calendar.month = 11;
          state.calendar.year -= 1;
        } else {
          state.calendar.month -= 1;
        }
      }
      renderCalendar();
    });
  }

  if (dom.btnCalNext) {
    dom.btnCalNext.addEventListener('click', () => {
      if (state.calendar.viewMode === 'day') {
        const next = navigateDay(state.calendar.selectedDate, 1);
        state.calendar.selectedDate = next.dateString;
        state.calendar.year = next.year;
        state.calendar.month = next.month;
      } else if (state.calendar.viewMode === 'week') {
        const cur = new Date(`${state.calendar.selectedDate}T00:00:00`);
        cur.setDate(cur.getDate() + 7);
        state.calendar.year = cur.getFullYear();
        state.calendar.month = cur.getMonth();
        state.calendar.selectedDate = formatCalendarDate(cur.getFullYear(), cur.getMonth(), cur.getDate());
      } else {
        if (state.calendar.month === 11) {
          state.calendar.month = 0;
          state.calendar.year += 1;
        } else {
          state.calendar.month += 1;
        }
      }
      renderCalendar();
    });
  }

  if (dom.btnCalToday) {
    dom.btnCalToday.addEventListener('click', () => {
      const today = new Date();
      state.calendar.year = today.getFullYear();
      state.calendar.month = today.getMonth();
      state.calendar.selectedDate = formatCalendarDate(today.getFullYear(), today.getMonth(), today.getDate());
      renderCalendar();
    });
  }

  dom.calViewModes.forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.calendar.viewMode = e.currentTarget.getAttribute('data-cal-view');
      renderCalendar();
    });
  });

  if (dom.btnCalAddForDate) {
    dom.btnCalAddForDate.addEventListener('click', () => {
      handleOpenAddModal(state.calendar.selectedDate);
    });
  }

  // Analytics Timeframe Tabs
  dom.analyticsTimeframeTabs.forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.analytics.timeFrame = e.currentTarget.getAttribute('data-timeframe');
      renderAnalytics();
    });
  });

  // Group By Select
  if (dom.groupBySelect) {
    dom.groupBySelect.addEventListener('change', (e) => {
      state.groupBy = e.target.value;
      renderTaskList();
    });
  }

  // Clear Tag Filter
  if (dom.btnClearTag) {
    dom.btnClearTag.addEventListener('click', () => {
      state.tagFilter = 'all';
      render();
    });
  }

  // Subtask Add Button in Modal
  if (dom.btnAddSubtask && dom.fieldNewSubtask) {
    const handleSubtaskAdd = () => {
      const title = dom.fieldNewSubtask.value.trim();
      if (title) {
        state.subtasksBuffer.push({
          id: (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)),
          title,
          completed: false,
        });
        dom.fieldNewSubtask.value = '';
        renderSubtasksEditor();
      }
    };

    dom.btnAddSubtask.addEventListener('click', handleSubtaskAdd);
    dom.fieldNewSubtask.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubtaskAdd();
      }
    });
  }

  // Smart Reminders Settings Controls
  if (dom.settingBrowserNotifications) {
    dom.settingBrowserNotifications.addEventListener('change', (e) => {
      state.reminderPreferences.browserNotifications = e.target.checked;
      saveReminderPreferences(state.reminderPreferences);
    });
  }

  if (dom.btnRequestNotificationPerm) {
    dom.btnRequestNotificationPerm.addEventListener('click', async () => {
      const res = await requestNotificationPermission();
      if (res === 'granted') {
        state.reminderPreferences.browserNotifications = true;
        if (dom.settingBrowserNotifications) dom.settingBrowserNotifications.checked = true;
        saveReminderPreferences(state.reminderPreferences);
        showToast('Browser notifications permission granted.', 'success');
      } else if (res === 'denied') {
        showToast('Browser notifications permission was denied in browser settings.', 'error');
      } else {
        showToast('Notifications are not supported in this browser.', 'info');
      }
    });
  }

  if (dom.settingInappAlerts) {
    dom.settingInappAlerts.addEventListener('change', (e) => {
      state.reminderPreferences.inAppAlerts = e.target.checked;
      saveReminderPreferences(state.reminderPreferences);
    });
  }

  if (dom.settingDueSoonHours) {
    dom.settingDueSoonHours.addEventListener('change', (e) => {
      state.reminderPreferences.dueSoonHours = parseInt(e.target.value, 10);
      saveReminderPreferences(state.reminderPreferences);
    });
  }

  // Add Task Buttons
  dom.btnAddTask.addEventListener('click', () => handleOpenAddModal());
  if (dom.btnHeaderAdd) dom.btnHeaderAdd.addEventListener('click', () => handleOpenAddModal());
  if (dom.btnEmptyAdd)  dom.btnEmptyAdd.addEventListener('click', () => handleOpenAddModal());

  // Modal Cancel & Close
  dom.modalClose.addEventListener('click', closeModal);
  dom.btnCancel.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Modal Form Submission & Recurrence Toggle
  if (dom.fieldRecurrence) {
    dom.fieldRecurrence.addEventListener('change', (e) => {
      if (dom.recurrenceCustomWrapper) {
        dom.recurrenceCustomWrapper.hidden = e.target.value !== 'custom';
      }
    });
  }
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

      if (state.currentView !== 'tasks') {
        switchView('tasks');
      } else {
        render();
      }
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
        if (state.currentView !== 'tasks') {
          switchView('tasks');
        } else {
          render();
        }
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

  // Search Input (immediate clear toggle + debounced filter render)
  dom.searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (dom.searchClear) {
      dom.searchClear.hidden = val.trim().length === 0;
    }
    const searchKbd = document.getElementById('search-kbd');
    if (searchKbd) {
      searchKbd.hidden = val.trim().length > 0;
    }
  });

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
      const saved = persistState();
      if (saved) {
        showToast('Theme set to Light.', 'info');
      }
    });
  }
  if (dom.btnThemeDark) {
    dom.btnThemeDark.addEventListener('click', () => {
      state.theme = 'dark';
      applyTheme('dark');
      saveTheme('dark');
      const saved = persistState();
      if (saved) {
        showToast('Theme set to Dark.', 'info');
      }
    });
  }
  if (dom.btnExportJson) dom.btnExportJson.addEventListener('click', handleExportJSON);
  if (dom.importFileInput) dom.importFileInput.addEventListener('change', handleImportJSON);

  // File upload accessible keyboard handling (Enter / Space on label)
  const fileUploadLabel = document.querySelector('.file-upload-label');
  if (fileUploadLabel && dom.importFileInput) {
    fileUploadLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dom.importFileInput.click();
      }
    });
  }

  if (dom.btnClearCompleted) dom.btnClearCompleted.addEventListener('click', handleClearCompletedTasks);
  if (dom.btnClearAll) dom.btnClearAll.addEventListener('click', handleResetAllTasks);

  // Form Character Counters
  if (dom.fieldTitle) dom.fieldTitle.addEventListener('input', updateCharCounters);
  if (dom.fieldDescription) dom.fieldDescription.addEventListener('input', updateCharCounters);
  if (dom.fieldNotes) dom.fieldNotes.addEventListener('input', updateCharCounters);

  // Keyboard navigation & Shortcuts
  document.addEventListener('keydown', (e) => {
    const isEditingText = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
    const isAnyModalOpen =
      (dom.modalOverlay && dom.modalOverlay.classList.contains('is-open')) ||
      (dom.settingsOverlay && dom.settingsOverlay.classList.contains('is-open')) ||
      (dom.confirmOverlay && dom.confirmOverlay.classList.contains('is-open')) ||
      (dom.paletteOverlay && dom.paletteOverlay.classList.contains('is-open'));

    // Command Palette Trigger: Cmd+K / Ctrl+K
    if (isPaletteTriggerEvent(e)) {
      e.preventDefault();
      if (dom.paletteOverlay && dom.paletteOverlay.classList.contains('is-open')) {
        closePalette();
      } else {
        openPalette();
      }
      return;
    }

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
      if (dom.paletteOverlay && dom.paletteOverlay.classList.contains('is-open')) {
        closePalette();
        return;
      }
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
      if (dom.paletteOverlay && dom.paletteOverlay.classList.contains('is-open')) {
        trapFocus(e, dom.paletteOverlay);
        return;
      }
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
    if (urlParams.get('clear') === '1') {
      state.tasks = [];
      saveTasks([]);
      persistState();
    }
    const pTheme = urlParams.get('theme');
    if (pTheme === 'dark' || pTheme === 'light') {
      state.theme = pTheme;
    }
    const pView = urlParams.get('view');
    if (pView === 'calendar' || pView === 'analytics' || pView === 'tasks') {
      state.currentView = pView;
    }
    if (urlParams.get('seed') === '1' && state.tasks.length === 0) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const yesterdayIso = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const futureIso = new Date(Date.now() + 259200000).toISOString().slice(0, 10);

      state.tasks = [
        createTask({
          title: 'Complete Quarterly System Architecture Review',
          description: 'Audit microservice boundaries, evaluate latency metrics and document ADRs.',
          priority: 'high',
          category: 'Work',
          dueDate: todayIso,
          tags: ['architecture', 'q4-review'],
          subtasks: [
            { title: 'Check microservice boundaries', completed: true },
            { title: 'Evaluate latency metrics', completed: false },
          ],
        }),
        createTask({
          title: 'Prepare UX presentation for product team',
          description: 'Showcase redesign tokens, mobile navigation drawer, and interaction flows.',
          priority: 'medium',
          category: 'Study',
          dueDate: tomorrowIso,
          tags: ['design', 'presentation'],
        }),
        createTask({
          title: 'Review tax documentation & investment portfolio',
          description: 'Download 1099 statements and reconcile monthly expense statements.',
          priority: 'high',
          category: 'Finance',
          dueDate: yesterdayIso,
          tags: ['taxes'],
          recurrence: { type: 'monthly' },
        }),
        createTask({
          title: 'Schedule annual health checkup & dental cleaning',
          description: 'Book appointment with Dr. Mehta for Friday afternoon.',
          priority: 'low',
          category: 'Health',
          dueDate: futureIso,
          tags: ['health'],
        }),
        {
          ...createTask({
            title: 'Setup GitHub branch protection and CodeQL workflow',
            description: 'Enforce strict status checks on main branch.',
            priority: 'medium',
            category: 'Work',
            tags: ['devops', 'security'],
          }),
          status: 'completed',
          completed: true,
        },
        {
          ...createTask({
            title: 'Morning 5km endurance run',
            description: 'Track pace and heart rate metrics.',
            priority: 'low',
            category: 'Health',
            tags: ['fitness'],
          }),
          status: 'completed',
          completed: true,
        },
      ];
      persistState();
    }
  }

  // Setup Command Palette instance
  setupCommandPalette();

  // Connect Toast notification manager container
  toastManager.setContainer(dom.toastContainer);

  // Apply theme immediately
  applyTheme(state.theme);

  // Bind all event handlers
  wireEvents();

  // Initial view switch and render
  switchView(state.currentView);

  // Initial Smart Reminders run and scheduled interval
  triggerSmartRemindersCheck();
  setInterval(triggerSmartRemindersCheck, 60000);

  // Expose state and toast hooks exclusively in test / debug mode
  if (urlParams && (urlParams.has('test') || urlParams.has('debug'))) {
    window.__taskflow_state = state;
    window.__taskflow_toasts = toastManager;
  }

  if (urlParams) {
    if (urlParams.get('modal') === 'add') {
      setTimeout(() => handleOpenAddModal(), 50);
    } else if (urlParams.get('modal') === 'settings') {
      setTimeout(() => openSettings(), 50);
    } else if (urlParams.get('modal') === 'palette') {
      setTimeout(() => openPalette(), 50);
    }
    if (urlParams.get('toast') === '1') {
      setTimeout(() => {
        toastManager.show('Task completed! Next recurrence scheduled for tomorrow.', 'success');
      }, 100);
    }
  }
}

// Initialize when DOM content is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
