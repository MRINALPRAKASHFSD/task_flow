# Architecture — TaskFlow

> Documentation License: Creative Commons Attribution 4.0 International (CC BY 4.0)
> See `LICENSE-CC-BY-4.0` in this directory.

## Overview

TaskFlow is a single-page, client-side productivity application built without framework dependencies or heavy build toolchains.
The application is composed of five modular ES JavaScript files, three structured CSS files, and a semantic HTML5 document.
All state is persisted in the browser's `localStorage` using a versioned schema with an in-memory fallback.

---

## File Dependency Graph

```
index.html
└── js/app.js          (application controller & UI orchestrator)
    ├── js/icons.js    (reusable SVG icon factory & semantic indicators)
    ├── js/storage.js  (versioned persistence layer & migration engine)
    ├── js/tasks.js    (domain model & entity operations — imports js/utils.js)
    ├── js/filters.js  (multi-criteria filtering & sorting — imports js/utils.js & js/tasks.js)
    └── js/utils.js    (date parsing, formatting & utility primitives)

css/styles.css         (@import css/variables.css — component architecture & SaaS styling)
css/responsive.css     (responsive rules for 320px, 375px, 768px, 1024px, 1440px, 1920px)
css/variables.css      (design system tokens for light & dark palettes)
```

---

## Module Responsibilities

### `js/icons.js` — SVG Icon Factory & Semantic Indicators

Generates standardized, accessible inline SVG elements with uniform dimensions, stroke styles, and decorative attributes:
- `createSvg(width, height, viewBox, extraClass)` — base SVG element constructor with `aria-hidden="true"` and `.tf-icon` styling.
- Task Action Icons: `createEditIcon()`, `createDeleteIcon()`, `createCheckIcon()`, `createPlusIcon()`.
- Temporal & Due Date Icons: `createCalendarIcon()`, `createClockIcon()`, `createAlertIcon()`, `createFlameIcon()`.
- Navigation & Control Icons: `createSunIcon()`, `createMoonIcon()`, `createSearchIcon()`, `createCloseIcon()`, `createSettingsIcon()`.
- Toast & State Icons: `createToastSuccessIcon()`, `createToastErrorIcon()`, `createToastInfoIcon()`, `createEmptyClipboardIcon()`.
- Semantic Indicators: `createPriorityDot(priority)` — renders semantic dot indicator.

### `js/tasks.js` — Domain Model & Operations

Pure domain logic with zero DOM or storage coupling.

Exports:
- `CATEGORIES` — frozen array of supported categories: `['Work', 'Personal', 'Study', 'Health', 'Finance', 'General']`.
- `PRIORITIES` — frozen array of supported priorities: `['low', 'medium', 'high']`.
- `createTask(input)` — validates input, assigns unique ID and timestamps, and returns a new `Task` entity.
- `updateTask(task, updates)` — returns a new, updated immutable `Task` entity.
- `toggleTaskStatus(task)` — toggles between `pending` (completed: `false`) and `completed` (completed: `true`).
- `reopenTask(task)` — explicitly sets status to `pending` and `completed` to `false`.
- `completeTask(task)` — explicitly sets status to `completed` and `completed` to `true`.
- `isTaskOverdue(task, refDate)` — checks whether a pending task has a due date before the reference date.
- `isTaskDueToday(task, refDate)` — checks whether a task's due date matches the reference date (local calendar day).
- `isTaskUpcoming(task, refDate)` — checks whether a pending task has a future due date.
- `validateTaskInput(input)` — validates title, description length, priority, category, and due date format.
- `addTask(tasks, task)` — immutably appends a task.
- `replaceTask(tasks, updated)` — immutably replaces a task by ID.
- `deleteTask(tasks, id)` — immutably removes a task by ID.
- `findTaskById(tasks, id)` — retrieves a task by ID.
- `computeStats(tasks)` — computes aggregate statistics: `total`, `pending`, `completed`, `highPriority`, `completionRate`, and non-enumerable `overdue`.

### `js/storage.js` — Versioned Persistence Layer

Handles data persistence, schema validation, backwards-compatible migration, and in-memory failover.

Exports:
- `STORAGE_KEYS` — persistence namespace keys: `APP_STATE`, `TASKS`, `THEME`, `FILTER`, `SORT`.
- `CURRENT_SCHEMA_VERSION` — schema version integer (`1`).
- `storageAvailable()` — probes whether `localStorage` is accessible and writable.
- `loadAppState()` — loads versioned state (`taskflow_data`); falls back to legacy keys (`taskflow_tasks`, etc.) or in-memory state.
- `saveAppState(state)` — persists versioned state with schema validation.
- `validateTaskRecord(raw)` — sanitizes individual task records against runtime corruption.
- `cleanseTaskList(rawList)` — scrubs arrays of tasks, filling missing defaults and discarding invalid entries.
- `exportAppStateJSON()` — serializes the current versioned application state to a formatted JSON string for offline backup.
- `importAppStateJSON(jsonString)` — validates, cleanses, and restores state from an external JSON backup file.
- Legacy compatibility APIs: `loadTasks`, `saveTasks`, `loadTheme`, `saveTheme`, `loadFilter`, `saveFilter`.
- `memoryStore` & `clearMemoryStore()` — test and private-mode memory fallback container.

### `js/filters.js` — Multi-Criteria Filtering & Sorting

Provides unified multi-filter evaluation and deterministic sorting.

Exports:
- `filterByStatus(tasks, filter, refDate)` — supports views: `'all'`, `'pending'`, `'completed'`, `'today'`, `'upcoming'`, `'overdue'`, and `'high'`.
- `filterByCategory(tasks, category)` — filters by task category (case-insensitive).
- `filterBySearch(tasks, query)` — debounced multi-field substring search across `title`, `description`, and `category`.
- `sortTasks(tasks, sortBy)` — deterministic sorting options:
  - `'default'` — pending first, priority (high → med → low), newest first.
  - `'newest'` — newest creation date first.
  - `'oldest'` — oldest creation date first.
  - `'priority'` — high → medium → low, then newest creation date.
  - `'dueDate'` — earliest due date first; tasks with due dates precede tasks without.
  - `'updated'` — most recently updated first.
- `applyFilters(tasks, options)` — single pipeline executing status filter, category filter, search query, and sorting.

### `js/utils.js` — Primitives & Date Formatting

Provides standard helpers with zero dependencies:
- `generateId()` — RFC 4122 v4 UUID via `crypto.randomUUID()` with fallback.
- `nowISO()` — ISO 8601 UTC timestamp.
- `parseLocalDate(dateStr)` — timezone-safe local date parser for `YYYY-MM-DD`.
- `isDateToday(dateStr, refDate)` — compares date string to local reference day.
- `isDateOverdue(dateStr, refDate)` — compares date string to local reference start-of-day.
- `isDateUpcoming(dateStr, refDate)` — compares date string to end of reference day.
- `isValidDateString(dateStr)` — validates calendar correctness and `YYYY-MM-DD` formatting.
- `formatDate(isoString)` — relative or human-readable creation/update date.
- `formatDueDate(dateStr)` — contextual due date formatting ("Today", "Tomorrow", "Overdue", or localized date).
- `formatHeaderDate(refDate)` — header date string (e.g., "Wednesday, April 15, 2026").
- `getGreeting(refDate)` — dynamic time-of-day greeting ("Good morning", "Good afternoon", "Good evening").
- `debounce(fn, delay)` — execution limiter for real-time search input.
- `normalise(str)` — safe case-folding and whitespace trimming.
- `setText(el, text)` — safe text node setter preventing XSS injection.

### `js/app.js` — Controller & Presentation

Coordinates state, events, and DOM updates:
- Orchestrates centralized application state: `tasks`, `theme`, `currentFilter`, `currentCategory`, `currentSort`, `searchQuery`, `editingTaskId`.
- Implements accessible modal dialogues for task creation and editing.
- Binds mobile navigation drawer with backdrop click-to-dismiss and escape key listeners.
- Manages real-time search input with instant clear button.
- Updates live dashboard counter badges across sidebar navigation items.
- Manages keyboard shortcuts (e.g., `Escape` closes modals and navigation drawer).
- Dispatches screen-reader announcements via `aria-live` polite regions.

---

## Data Model

```typescript
interface Task {
  id:          string;                     // UUID v4
  title:       string;                     // 1–200 characters (trimmed)
  description: string;                     // 0–1000 characters (trimmed)
  priority:    'low' | 'medium' | 'high';  // Priority classification
  category:    string;                     // 'Work' | 'Personal' | 'Study' | 'Health' | 'Finance' | 'General'
  status:      'pending' | 'completed';    // Workflow state
  completed:   boolean;                    // Boolean synchronization with status
  dueDate:     string | null;              // YYYY-MM-DD date string or null
  createdAt:   string;                     // ISO 8601 UTC timestamp
  updatedAt:   string;                     // ISO 8601 UTC timestamp
}

interface AppState {
  version:     number;                     // Schema version (currently 1)
  tasks:       Task[];                     // Cleansed task records
  preferences: {
    theme:     'light' | 'dark';           // Active color theme
    filter:    string;                     // Active status/deadline filter
    sortBy:    string;                     // Active sorting strategy
    category:  string;                     // Active category filter ('all' or specific)
  };
}
```

---

## Storage Architecture & Migration

| Key | Format | Description |
|---|---|---|
| `taskflow_data` | JSON object (`AppState`) | Versioned schema containing task records and user preferences |
| `taskflow_tasks` | JSON array (`Task[]`) | Legacy Phase 1 store (automatically migrated to `taskflow_data`) |
| `taskflow_theme` | JSON string (`'light'\|'dark'`) | Legacy theme preference store |
| `taskflow_filter` | JSON string (`string`) | Legacy filter preference store |

### Migration Strategy & Import Pipeline:
1. `loadAppState()` attempts to load `taskflow_data`.
2. If absent or invalid, it inspects legacy keys (`taskflow_tasks`, `taskflow_theme`, `taskflow_filter`).
3. Legacy records are cleansed, default fields (`category: 'General'`, `completed: false`, `dueDate: null`) are populated, and the unified state is saved to `taskflow_data`.
4. If storage access throws or is blocked (e.g., private browsing restriction), an in-memory session store takes over as a fallback.
5. `importAppStateJSON()` implements defensive transactional validation:
   - Root structure verification (object with `tasks` array, or legacy `Task[]` array).
   - Schema version bounds check (current: `version 1`).
   - Duplicate ID collision detection (rejects corrupted backups containing conflicting IDs).
   - Strict preferences sanitisation (bounds-checking for theme, filter, category, and sortBy).
   - Task cleansing and length clamping.
   - If validation fails or storage write fails, existing state is strictly preserved without modification.

---

## DOM Safety & Security

- **Strict XSS Prevention**: All user input (`title`, `description`, `category`) is injected via `textContent` or dedicated DOM nodes (`document.createElement`). `innerHTML` is never used for untrusted data.
- **Prototype Pollution Resistance**: Backup imports and stored records use explicit property lookups and whitelisted keys rather than unchecked object merges.
- **Zero Remote Dependencies**: The application does not load external CDN scripts, fonts, analytics, or trackers.
- **Content Security Policy Ready**: Fully compatible with strict CSP configurations (`default-src 'self'`).
- **No `eval` or dynamic code evaluation**: Evaluated code execution is completely prohibited.

---

## Accessibility (A11y) & Focus Management

- **Semantic Landmarks**: Uses `<header>`, `<nav>`, `<main>`, `<aside>`, and `<footer>` elements.
- **Accessible Dialogs & Focus Trapping**:
  - Implements `role="dialog"` (and `role="alertdialog"` for confirmations), `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`.
  - Background elements (`.app-layout`) are dynamically set to `aria-hidden="true"` while dialogs are open to prevent background screen-reader interaction.
  - Active focus is trapped via `trapFocus()`: `Tab` wraps from the last focusable element to the first, and `Shift + Tab` wraps from first to last.
  - The `Escape` key closes active dialogs in hierarchical priority order.
  - Upon dialog closure, keyboard focus is reliably restored to the specific element that invoked the dialog.
- **Screen Reader Announcements**: Live region (`#toast-container` and stats counters) with `aria-live="polite"` announces task addition, status changes, deletions, and filter counts.
- **Keyboard Navigation**: Full tab order traversal, skip-navigation link (`#skip-link`), and focus preservation upon modal dismissal.
- **High-Contrast & Reduced-Motion**: Honors `prefers-reduced-motion: reduce` and `forced-colors: active` system preferences.

---

## Known Limitations

- **Client-Side Scope**: TaskFlow is intentionally built as an offline-first client application. It does not provide real-time multi-device cloud synchronization or server-side authentication.
- **Browser Storage Quota**: LocalStorage typically provides up to 5MB of storage per origin. When storage quota is exhausted, TaskFlow warns the user and temporarily utilizes an in-memory session store.
- **Device-Bound Data**: Data resides in the local browser profile. Users must export offline JSON backups to migrate their tasks between devices or browsers.
