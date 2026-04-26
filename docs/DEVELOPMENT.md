# Development Guide — TaskFlow

> Documentation License: Creative Commons Attribution 4.0 International (CC BY 4.0)
> See `LICENSE-CC-BY-4.0` in this directory.

## Prerequisites

| Tool | Minimum Version | Purpose |
|---|---|---|
| Node.js | 20.x LTS or higher | Running unit tests and the lightweight dev server |
| Git | 2.40+ | Version control |
| Browser | Modern Chrome, Firefox, Safari, or Edge | Client-side execution and debugging |

No external bundlers, transpilers, or runtime dependencies are required.

---

## Initial Setup

```bash
# Clone the repository
git clone https://github.com/MRINALPRAKASHFSD/taskflow.git
cd taskflow

# Add upstream if working in a fork
git remote add upstream https://github.com/MRINALPRAKASHFSD/taskflow.git

# Verify setup and run the validation suite
npm run check
```

---

## Local Development & Preview

```bash
# Option 1: Open index.html directly in your browser
open index.html

# Option 2: Run the built-in zero-dependency local dev server
npm start
# Server listens on: http://localhost:8080
```

---

## Code Quality & Testing

### Running Tests

```bash
# Run full validation check (syntax checks + unit tests)
npm run check

# Run all unit tests
npm test

# Run individual test suites
npm run test:tasks
npm run test:filters
npm run test:storage

# Watch mode for iterative development
npm run test:watch
```

Tests use the native **Node.js test runner** (`node:test`) and assertion module (`node:assert/strict`).

---

## Project Structure Overview

```
├── .github/              # Issue templates, PR template, and GitHub Actions workflows
├── assets/               # Icons, screenshots, and visual branding
├── css/
│   ├── variables.css     # CSS custom properties and color palettes
│   ├── styles.css        # Dashboard layout, typography, components, and modal styles
│   └── responsive.css    # Media queries, mobile navigation drawer, and accessibility rules
├── js/
│   ├── app.js            # Controller orchestrating state, events, and UI rendering
│   ├── storage.js        # Versioned localStorage persistence, validation, and migration
│   ├── tasks.js          # Pure domain model, task factory, and stats calculations
│   ├── filters.js        # Filtering, multi-field search, and sorting algorithms
│   └── utils.js          # Date formatting, UUID generation, debouncing, and DOM helpers
├── docs/                 # Architectural specs, user guides, and license notices
├── tests/
│   ├── tasks.test.js     # Task creation, validation, update, and lifecycle tests
│   ├── filters.test.js   # Status filtering, category filtering, search, and sorting tests
│   └── storage.test.js   # LocalStorage persistence, validation, and schema migration tests
├── index.html            # Main semantic HTML5 application layout
└── package.json          # Scripts and project metadata (zero production dependencies)
```

---

## Coding Conventions & Security Practices

- **Zero Runtime Dependencies**: Keep the application purely client-side without third-party frameworks.
- **Strict DOM Safety**: Never use `innerHTML` with unsanitized user inputs. Always use `textContent` or `document.createElement`.
- **No `eval`**: Dynamic code generation via `eval()` or `new Function()` is prohibited.
- **Defensive Persistence**: All `localStorage` operations are encapsulated within `js/storage.js` with fallback in-memory recovery.
- **Accessible by Design**: All interactive controls must feature keyboard navigation support, proper ARIA landmarks, and focus management.
- **Conventional Commits**: Format commit messages according to the Conventional Commits specification: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
