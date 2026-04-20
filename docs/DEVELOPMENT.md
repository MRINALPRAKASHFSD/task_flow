# Development Guide — TaskFlow

> Documentation License: Creative Commons Attribution 4.0 International (CC BY 4.0)

## Prerequisites

| Tool    | Minimum version | Purpose |
|---------|----------------|---------|
| Node.js | 20.x LTS       | Running tests and the dev server |
| Git     | 2.40+          | Version control |
| Browser | Latest Chrome, Firefox, Safari or Edge | Manual testing |

No bundler, transpiler or build step is required.

---

## Initial Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/taskflow.git
cd taskflow

# Add upstream
git remote add upstream https://github.com/MRINALPRAKASHFSD/taskflow.git

# Verify setup
npm test
```

---

## Running Locally

```bash
# Open directly (works in most browsers)
open index.html

# OR use the minimal dev server (required if browser blocks ES module imports on file://)
npm start
# → http://localhost:8080
```

---

## Running Tests

```bash
# All tests
npm test

# Individual suites
npm run test:tasks
npm run test:filters
npm run test:storage

# Watch mode
npm run test:watch
```

Tests use the **Node.js built-in test runner** (`node:test`) — no external dependencies.

---

## Adding a Feature

1. Create a branch: `git checkout -b feat/my-feature upstream/main`
2. Implement the feature in the relevant module(s).
3. Add unit tests in the relevant `tests/*.test.js` file.
4. Verify: `npm test` must be green.
5. Update `CHANGELOG.md` under `[Unreleased]`.
6. Update `docs/USER_GUIDE.md` if the feature is user-facing.
7. Push and open a pull request.

---

## Code Conventions

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full code standards.

### Key rules (summary)
- ES modules throughout. `"type": "module"` is set in `package.json`.
- No `innerHTML` with unsanitised content. Use `textContent` or DOM APIs.
- No `eval` or `Function()` constructor.
- Wrap all `localStorage` access in try/catch.
- JSDoc all exported functions.
- Conventional Commits for all commit messages.

---

## Updating GitHub Actions Pins

Actions are pinned to full commit SHAs for supply-chain security.

To update a pin:
1. Visit the action's GitHub releases page (e.g., `https://github.com/actions/checkout/releases`).
2. Find the commit SHA for the latest release tag.
3. Replace the SHA in the relevant workflow file in `.github/workflows/`.
4. Update the comment next to the SHA with the new version and date.
5. Commit: `chore(ci): update actions/checkout to v4.x.x`.

---

## Project Structure

```
taskflow/
├── .github/
│   ├── ISSUE_TEMPLATE/    Issue forms (YAML)
│   ├── workflows/         GitHub Actions
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   └── pull_request_template.md
├── assets/
│   ├── icons/             App icons (future)
│   ├── screenshots/       Screenshots (added after release)
│   └── fonts/             Web fonts (none currently — system fonts used)
├── css/
│   ├── variables.css      Design tokens
│   ├── styles.css         Component styles
│   └── responsive.css     Media queries
├── js/
│   ├── app.js             UI shell and event wiring
│   ├── tasks.js           Domain model
│   ├── storage.js         Persistence
│   ├── filters.js         Filtering and sorting
│   └── utils.js           Shared helpers
├── docs/
│   ├── ARCHITECTURE.md
│   ├── USER_GUIDE.md
│   ├── DEVELOPMENT.md     (this file)
│   ├── LICENSE-CC-BY-4.0
│   └── THIRD_PARTY_NOTICES.md
├── tests/
│   ├── tasks.test.js
│   ├── filters.test.js
│   └── storage.test.js
├── index.html
├── package.json
├── README.md
├── LICENSE
├── NOTICE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── SUPPORT.md
├── GOVERNANCE.md
├── CHANGELOG.md
├── ROADMAP.md
├── AUTHORS.md
├── .gitignore
├── .editorconfig
├── .gitattributes
└── .npmrc
```
