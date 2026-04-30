# TaskFlow

> **Plan smarter. Stay organized. Get things done.**

[![CI](https://github.com/MRINALPRAKASHFSD/taskflow/actions/workflows/ci.yml/badge.svg)](https://github.com/MRINALPRAKASHFSD/taskflow/actions/workflows/ci.yml)
[![CodeQL](https://github.com/MRINALPRAKASHFSD/taskflow/actions/workflows/codeql.yml/badge.svg)](https://github.com/MRINALPRAKASHFSD/taskflow/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docs: CC BY 4.0](https://img.shields.io/badge/Docs-CC%20BY%204.0-lightgrey.svg)](docs/LICENSE-CC-BY-4.0)
[![GitHub Template](https://img.shields.io/badge/GitHub-Template%20Repository-8A2BE2)](https://github.com/MRINALPRAKASHFSD/taskflow/generate)

TaskFlow is a lightweight, dependency-free to-do manager built with HTML5, CSS3 and Vanilla JavaScript.
It runs entirely in the browser, persists data in LocalStorage, and requires no build step, no server and no framework.

---

## Screenshots

> **Note:** Screenshots will be added after the first public release.
> The `assets/screenshots/` directory is reserved for them.

| Light Theme | Dark Theme |
|-------------|------------|
| *(placeholder — light theme screenshot)* | *(placeholder — dark theme screenshot)* |
| *(placeholder — mobile view)* | *(placeholder — task form)* |

---

## Features

| Feature | Description |
|---------|-------------|
| ✅ Create tasks | Add tasks with a title, optional description and priority. |
| ✏️ Edit tasks | Update any task in place via the edit modal. |
| 🗑️ Delete tasks | Remove tasks with a confirmation prompt. |
| ☑️ Toggle status | Mark tasks as completed or pending with a single click. |
| 🔴🟡🟢 Priority | Assign Low, Medium or High priority with colour-coded indicators. |
| 🔍 Search | Real-time search across title and description. |
| 🗂️ Filter | Filter by All, Pending or Completed. |
| 📊 Statistics | Dashboard showing total, pending, completed and high-priority counts. |
| 📈 Progress bar | Completion percentage visualised as a progress bar. |
| 💾 Persistence | Tasks, theme and active filter saved to LocalStorage. |
| 🕐 Timestamps | Creation and update times shown as relative labels. |
| 🌙 Light / Dark | Theme follows OS preference; user override is persisted. |
| 📱 Responsive | Works on mobile (320 px) through large desktop (1280 px+). |
| ♿ Accessible | Skip link, ARIA attributes, keyboard navigation, focus management. |
| 📭 Empty states | Context-sensitive messages when no tasks match the view or search. |
| 🔔 Toast notifications | Non-blocking feedback for every action. |
| 🛡️ Validation | Client-side form validation with accessible inline error messages. |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 (semantic elements) |
| Styles | CSS3 (custom properties, CSS Grid, Flexbox) |
| Logic | Vanilla JavaScript ES6+ (ES modules) |
| Persistence | Browser LocalStorage |
| Testing | Node.js built-in test runner (`node:test`) |
| CI | GitHub Actions |
| Security | GitHub CodeQL |
| Dependencies | **None** |

---

## Installation

### Option A — Open directly in a browser

No installation required. Clone or download the repository and open `index.html`:

```bash
git clone https://github.com/MRINALPRAKASHFSD/taskflow.git
cd taskflow
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

### Option B — Minimal dev server

If you need module imports to resolve correctly over HTTP (some browsers block ES modules from `file://`):

```bash
git clone https://github.com/MRINALPRAKASHFSD/taskflow.git
cd taskflow
npm start
# Open http://localhost:8080
```

Node.js ≥ 20 is required only for running the dev server and tests.

---

## Usage

### Adding a task

1. Click the **Add Task** button in the toolbar.
2. Enter a title (required) and an optional description.
3. Choose a priority (Low, Medium or High).
4. Click **Save Task**.

### Editing a task

- Hover over a task card and click the **✏️** (edit) button.
- Modify the fields in the modal and click **Save Task**.

### Completing a task

- Click the circle checkbox on the left of a task card.
- The task is marked completed and moves to the bottom of the list.

### Deleting a task

- Hover over a task card and click the **🗑️** (delete) button.
- Confirm the deletion in the dialog.

### Filtering and searching

- Use the **All / Pending / Completed** tabs or the sidebar navigation.
- Type in the search box to filter tasks by title or description in real time.

### Switching themes

- Click the **🌙 / ☀️** button in the header to toggle between light and dark themes.
- Your preference is saved automatically.

---

## Project Architecture

```
taskflow/
├── index.html              Entry point — semantic HTML structure
├── css/
│   ├── variables.css       Design tokens (colours, spacing, typography)
│   ├── styles.css          Main application styles
│   └── responsive.css      Media queries and responsive adjustments
├── js/
│   ├── app.js              Application entry point — wires state, DOM and events
│   ├── tasks.js            Task domain model — create, update, delete, validate, stats
│   ├── storage.js          LocalStorage abstraction layer
│   ├── filters.js          Filter and sort logic
│   └── utils.js            Shared utility helpers (ID generation, date formatting, etc.)
├── tests/
│   ├── tasks.test.js       72 unit tests across all modules
│   ├── filters.test.js
│   └── storage.test.js
└── docs/
    ├── ARCHITECTURE.md     Detailed architecture documentation
    ├── USER_GUIDE.md       End-user documentation
    ├── DEVELOPMENT.md      Developer setup guide
    ├── THIRD_PARTY_NOTICES.md  Third-party attribution
    └── LICENSE-CC-BY-4.0  CC BY 4.0 license text for documentation
```

### Data model

```js
{
  id:          string,    // Unique UUID or fallback identifier
  title:       string,    // 1–200 characters (required)
  description: string,    // 0–1000 characters (optional)
  priority:    'low' | 'medium' | 'high',
  status:      'pending' | 'completed',
  createdAt:   string,    // ISO 8601
  updatedAt:   string,    // ISO 8601
}
```

### Module responsibilities

| Module | Responsibility |
|--------|---------------|
| `tasks.js` | Pure functions — task creation, mutation, validation and statistics. No DOM or storage access. |
| `storage.js` | All LocalStorage reads and writes, wrapped in try/catch. |
| `filters.js` | Pure filter and sort functions. No side effects. |
| `utils.js` | Shared helpers: ID generation, date formatting, debounce. |
| `app.js` | Wires everything together: reads state, calls domain functions, updates the DOM. |

---

## Testing

```bash
# Run all 72 unit tests
npm test

# Run individual test files
npm run test:tasks
npm run test:filters
npm run test:storage

# Watch mode (re-runs on file change)
npm run test:watch
```

Tests use the **Node.js built-in test runner** — no external test framework is required.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

Key points:
- Branch from `main` using `feat/`, `fix/`, `docs/`, etc.
- Follow [Conventional Commits](https://www.conventionalcommits.org/).
- Ensure `npm test` passes before submitting.
- Fill in the pull request template completely.

---

## Security

Please do **not** report security vulnerabilities as public GitHub issues.
Use [GitHub Security Advisories](https://github.com/MRINALPRAKASHFSD/taskflow/security/advisories/new).

See [SECURITY.md](SECURITY.md) for the full policy.

---

## Licensing

| Scope | License |
|-------|---------|
| Application source code (`js/`, `css/`, `index.html`, `tests/`) | [MIT](LICENSE) |
| Documentation (`docs/`, `README.md`, `CONTRIBUTING.md`, etc.) | [CC BY 4.0](docs/LICENSE-CC-BY-4.0) |
| Third-party assets | See [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) |

Copyright © 2026 Mrinal Prakash.

The MIT License permits use, modification and distribution of the source code
with attribution. The CC BY 4.0 license permits sharing and adapting the
documentation with attribution.

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features including due dates, tags,
drag-and-drop reordering, subtasks and PWA support.

---

## Author

**Mrinal Prakash**
GitHub: [@MRINALPRAKASHFSD](https://github.com/MRINALPRAKASHFSD)

---

## Using as a Template

TaskFlow is configured as a **GitHub Template Repository**.
Click [**Use this template**](https://github.com/MRINALPRAKASHFSD/taskflow/generate) to create a new
repository with all files but a clean, unrelated Git history.

---

*Made with ❤️ — Plan smarter. Stay organized. Get things done.*
