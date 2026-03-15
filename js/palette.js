/**
 * TaskFlow — palette.js
 * Command Palette engine and keyboard navigation controller.
 * Provides fuzzy-like search, keyboard shortcuts, accessible combobox ARIA semantics,
 * and command registration for rapid navigation.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { normalise } from './utils.js';

/**
 * @typedef {Object} Command
 * @property {string}   id          - Unique identifier.
 * @property {string}   title       - Human-readable command title.
 * @property {string}   category    - Category grouping ('Navigation'|'Actions'|'Views'|'Settings').
 * @property {string}   [shortcut]  - Key shortcut label (e.g. 'Cmd+K', 'N', '/').
 * @property {string[]} [keywords]  - Search keywords for discovery.
 * @property {Function} [handler]   - Execution callback.
 */

export const DEFAULT_COMMANDS = Object.freeze([
  {
    id: 'nav-dashboard',
    title: 'Go to Tasks Dashboard',
    category: 'Navigation',
    shortcut: 'G T',
    keywords: ['tasks', 'dashboard', 'home', 'todo', 'list'],
  },
  {
    id: 'nav-calendar',
    title: 'Go to Calendar View',
    category: 'Navigation',
    shortcut: 'G C',
    keywords: ['calendar', 'month', 'week', 'schedule', 'dates'],
  },
  {
    id: 'nav-analytics',
    title: 'Go to Productivity Analytics',
    category: 'Navigation',
    shortcut: 'G A',
    keywords: ['analytics', 'stats', 'metrics', 'trends', 'productivity', 'charts'],
  },
  {
    id: 'action-create-task',
    title: 'Create New Task',
    category: 'Actions',
    shortcut: 'N',
    keywords: ['add', 'new', 'create', 'task', 'todo'],
  },
  {
    id: 'action-focus-search',
    title: 'Search Tasks',
    category: 'Actions',
    shortcut: '/',
    keywords: ['find', 'filter', 'query', 'search'],
  },
  {
    id: 'action-toggle-theme',
    title: 'Toggle Dark / Light Theme',
    category: 'Settings',
    shortcut: 'T',
    keywords: ['theme', 'dark', 'light', 'mode', 'color'],
  },
  {
    id: 'action-open-settings',
    title: 'Open Settings & Backups',
    category: 'Settings',
    shortcut: 'S',
    keywords: ['settings', 'preferences', 'export', 'import', 'backup'],
  },
  {
    id: 'filter-overdue',
    title: 'View Overdue Tasks',
    category: 'Views',
    shortcut: 'F O',
    keywords: ['overdue', 'late', 'pending', 'expired'],
  },
  {
    id: 'filter-today',
    title: 'View Tasks Due Today',
    category: 'Views',
    shortcut: 'F T',
    keywords: ['today', 'due', 'now', 'schedule'],
  },
  {
    id: 'filter-high-priority',
    title: 'View High Priority Tasks',
    category: 'Views',
    shortcut: 'F H',
    keywords: ['high', 'urgent', 'priority', 'important'],
  },
]);

/**
 * Filter an array of commands by search query across title, category, keywords, and shortcut.
 *
 * @param {Array<Command>} commands
 * @param {string} query
 * @returns {Array<Command>}
 */
export function filterCommands(commands, query) {
  if (!Array.isArray(commands)) return [];
  const q = normalise(query);
  if (!q) return [...commands];

  return commands.filter(cmd => {
    if (normalise(cmd.title).includes(q)) return true;
    if (normalise(cmd.category).includes(q)) return true;
    if (cmd.shortcut && normalise(cmd.shortcut).includes(q)) return true;
    if (Array.isArray(cmd.keywords) && cmd.keywords.some(k => normalise(k).includes(q))) {
      return true;
    }
    return false;
  });
}

/**
 * State machine and controller for the Command Palette.
 *
 * @param {object} [options]
 * @param {Array<Command>} [options.commands]
 * @param {Function} [options.onSelect]
 * @param {Function} [options.onClose]
 */
export function createCommandPalette(options = {}) {
  const registeredCommands = Array.isArray(options.commands)
    ? [...options.commands]
    : [...DEFAULT_COMMANDS];

  let isOpen = false;
  let query = '';
  let selectedIndex = 0;
  let filteredList = [...registeredCommands];

  function updateFiltered() {
    filteredList = filterCommands(registeredCommands, query);
    if (selectedIndex >= filteredList.length) {
      selectedIndex = Math.max(0, filteredList.length - 1);
    }
  }

  return {
    isOpen() {
      return isOpen;
    },
    open() {
      isOpen = true;
      query = '';
      selectedIndex = 0;
      updateFiltered();
    },
    close() {
      isOpen = false;
      query = '';
      selectedIndex = 0;
      if (typeof options.onClose === 'function') {
        options.onClose();
      }
    },
    getQuery() {
      return query;
    },
    setQuery(newQuery) {
      query = String(newQuery || '');
      selectedIndex = 0;
      updateFiltered();
    },
    getFilteredCommands() {
      return filteredList;
    },
    getSelectedIndex() {
      return selectedIndex;
    },
    getSelectedCommand() {
      return filteredList[selectedIndex] || null;
    },
    selectNext() {
      if (filteredList.length === 0) return;
      selectedIndex = (selectedIndex + 1) % filteredList.length;
    },
    selectPrevious() {
      if (filteredList.length === 0) return;
      selectedIndex = (selectedIndex - 1 + filteredList.length) % filteredList.length;
    },
    setSelectedIndex(idx) {
      if (idx >= 0 && idx < filteredList.length) {
        selectedIndex = idx;
      }
    },
    executeSelected() {
      const selected = filteredList[selectedIndex];
      if (!selected) return null;

      if (typeof selected.handler === 'function') {
        selected.handler();
      }
      if (typeof options.onSelect === 'function') {
        options.onSelect(selected);
      }
      this.close();
      return selected;
    },
    registerCommand(command) {
      if (command && typeof command.id === 'string') {
        registeredCommands.push(command);
        updateFiltered();
      }
    },
  };
}

/**
 * Determine whether a keydown event should open the Command Palette.
 * Checks for Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 *
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function isPaletteTriggerEvent(event) {
  if (!event) return false;
  const isK = event.key === 'k' || event.key === 'K';
  const hasModifier = Boolean(event.metaKey || event.ctrlKey);
  return isK && hasModifier && !event.shiftKey && !event.altKey;
}

