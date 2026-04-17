# Architecture — TaskFlow

> Documentation License: Creative Commons Attribution 4.0 International (CC BY 4.0)
> See `LICENSE-CC-BY-4.0` in this directory.

## Overview

TaskFlow is a single-page, client-side application built without a framework or build tool.
The application is composed of five ES module JavaScript files, three CSS files and one HTML file.
All data is stored in the browser's `localStorage`.

---

## File Dependency Graph

```
index.html
└── js/app.js          (entry point — imports all modules)
    ├── js/storage.js  (localStorage abstraction)
    ├── js/tasks.js    (domain model — imports js/utils.js)
    ├── js/filters.js  (filter + sort — imports js/utils.js)
    └── js/utils.js    (shared helpers — no imports)

css/styles.css         (@import css/variables.css)
css/responsive.css     (standalone — read after styles.css)
css/variables.css      (CSS custom properties)
```

---

## Module Responsibilities

### `js/tasks.js` — Domain model

Pure functions only. No DOM access. No storage access.

Exports:
- `createTask(input)` — validates input and returns a new Task object.
- `updateTask(task, updates)` — applies updates to an existing task (immutable).
- `toggleTaskStatus(task)` — toggles `pending` ↔ `completed`.
- `validateTaskInput(input)` — returns `{ valid, errors }`.
- `addTask(tasks, task)` — returns a new array with the task appended.
- `replaceTask(tasks, updated)` — returns a new array with the task replaced.
- `deleteTask(tasks, id)` — returns a new array with the task removed.
- `findTaskById(tasks, id)` — finds a task by ID.
- `computeStats(tasks)` — computes dashboard statistics.

### `js/storage.js` — Persistence layer

All localStorage access goes through this module. Every read and write is wrapped in try/catch.

Exports:
- `loadTasks()` / `saveTasks(tasks)`
- `loadTheme()` / `saveTheme(theme)`
- `loadFilter()` / `saveFilter(filter)`
- `storageAvailable()` — probe check for availability.

### `js/filters.js` — Filtering and sorting

Pure functions. No side effects.

Exports:
- `filterByStatus(tasks, filter)` — filters by 'all' | 'pending' | 'completed'.
- `filterBySearch(tasks, query)` — case-insensitive substring search on title and description.
- `applyFilters(tasks, options)` — composes status and search filters in one pass.
- `sortTasks(tasks)` — sorts by: completed-last → priority-descending → newest-first.

### `js/utils.js` — Shared helpers

No imports. Provides:
- `generateId()` — uses `crypto.randomUUID()` when available, falls back to timestamp+random.
- `nowISO()` — current ISO 8601 timestamp.
- `formatDate(isoString)` — human-readable relative date label.
- `debounce(fn, delay)` — delays function execution.
- `normalise(str)` — lowercase + trim for search comparison.
- `setText(el, text)` — safely sets `textContent`.

### `js/app.js` — Application shell

Imports all other modules. Manages:
- Application state (`tasks`, `theme`, `filter`, `search`, `editingId`).
- DOM event wiring (clicks, form submissions, keyboard events).
- Rendering (stats, filter tabs, task list, empty state).
- Modal lifecycle (open, close, focus management).
- Toast notifications.
- Confirmation dialogs.

---

## Data Model

```typescript
interface Task {
  id:          string;   // UUID or fallback
  title:       string;   // 1–200 chars, required
  description: string;   // 0–1000 chars, optional
  priority:    'low' | 'medium' | 'high';
  status:      'pending' | 'completed';
  createdAt:   string;   // ISO 8601
  updatedAt:   string;   // ISO 8601
}
```

---

## LocalStorage Keys

| Key                  | Value                        |
|----------------------|------------------------------|
| `taskflow_tasks`     | JSON array of Task objects   |
| `taskflow_theme`     | `'light'` or `'dark'`        |
| `taskflow_filter`    | `'all'`, `'pending'` or `'completed'` |

---

## DOM Safety

All user-supplied content is written to the DOM using `textContent` or explicit DOM API methods.
`innerHTML` is never used with unsanitised data. `eval` is not used anywhere.

---

## Security Considerations

- No network requests are made at runtime.
- No third-party scripts are loaded.
- LocalStorage errors are caught and reported as toast messages.
- Form inputs are validated before processing.
- Unique task IDs use `crypto.randomUUID()` when available.

---

## CSS Architecture

| File | Purpose |
|------|---------|
| `css/variables.css` | All CSS custom properties (design tokens). Both light and dark theme values. |
| `css/styles.css` | Component and layout styles. Imports `variables.css`. |
| `css/responsive.css` | Media queries. Breakpoints at 1280px, 1023px, 767px and 479px. |

Theme switching is achieved by toggling `data-theme="dark"` on the `<html>` element.

---

## Accessibility

- Skip navigation link (`<a href="#main-content" class="skip-link">`).
- All interactive elements have accessible labels (`aria-label` or associated `<label>`).
- Live regions (`aria-live`) announce task list and stat changes to screen readers.
- Modal dialogs use `role="dialog"`, `aria-modal="true"` and `aria-labelledby`.
- Confirmation dialog uses `role="alertdialog"`.
- Focus is managed on modal open and close.
- `prefers-reduced-motion` media query disables animations.
- `forced-colors` media query preserves usability in Windows High Contrast mode.
