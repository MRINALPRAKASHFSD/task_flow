# Contributing to TaskFlow

Thank you for investing your time in contributing to TaskFlow!
Please read this document before opening an issue or pull request.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Ways to Contribute](#ways-to-contribute)
3. [Development Setup](#development-setup)
4. [Branch Naming](#branch-naming)
5. [Commit Conventions](#commit-conventions)
6. [Pull Request Process](#pull-request-process)
7. [Code Standards](#code-standards)
8. [Testing](#testing)
9. [Documentation](#documentation)

---

## Code of Conduct

All contributors must follow the [Code of Conduct](CODE_OF_CONDUCT.md).
Constructive, respectful communication is expected at all times.

---

## Ways to Contribute

- **Bug reports** — open a [Bug Report](https://github.com/MRINALPRAKASHFSD/taskflow/issues/new?template=bug_report.yml).
- **Feature requests** — open a [Feature Request](https://github.com/MRINALPRAKASHFSD/taskflow/issues/new?template=feature_request.yml).
- **Questions** — open a [Question](https://github.com/MRINALPRAKASHFSD/taskflow/issues/new?template=question.yml) or use [Discussions](https://github.com/MRINALPRAKASHFSD/taskflow/discussions).
- **Code contributions** — fix a bug, implement a feature or improve tests.
- **Documentation improvements** — fix typos, clarify explanations.

---

## Development Setup

### Prerequisites

| Tool       | Minimum Version |
|------------|----------------|
| Node.js    | 20.x LTS       |
| Git        | 2.40+          |

> **Note:** No build step or bundler is required. TaskFlow is plain HTML, CSS and ES-module JavaScript.

### Steps

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/taskflow.git
cd taskflow

# 2. Add the upstream remote
git remote add upstream https://github.com/MRINALPRAKASHFSD/taskflow.git

# 3. Install dependencies (there are none, but this verifies package.json)
npm install

# 4. Run the test suite
npm test

# 5. Open index.html in your browser directly (no server needed for most features)
#    OR start the minimal dev server:
npm start
# then visit http://localhost:8080
```

---

## Branch Naming

Use the following naming conventions:

| Type            | Pattern                       | Example                         |
|-----------------|-------------------------------|---------------------------------|
| Feature         | `feat/<short-description>`    | `feat/priority-sorting`         |
| Bug fix         | `fix/<short-description>`     | `fix/localstorage-quota-error`  |
| Documentation   | `docs/<short-description>`    | `docs/update-architecture`      |
| Refactor        | `refactor/<short-description>`| `refactor/storage-module`       |
| Test            | `test/<short-description>`    | `test/add-filter-coverage`      |
| Chore           | `chore/<short-description>`   | `chore/update-actions-pins`     |
| Security fix    | `security/<short-description>`| `security/fix-xss-vectors`      |

Always branch from `main`:

```bash
git fetch upstream
git checkout -b feat/my-feature upstream/main
```

---

## Commit Conventions

TaskFlow uses **Conventional Commits** (https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types

| Type         | When to use                                       |
|--------------|---------------------------------------------------|
| `feat`       | A new feature                                     |
| `fix`        | A bug fix                                         |
| `docs`       | Documentation only changes                        |
| `style`      | Formatting, whitespace — no logic change          |
| `refactor`   | Code restructure without adding features or fixes |
| `test`       | Adding or correcting tests                        |
| `chore`      | Tooling, dependency updates, CI configuration     |
| `security`   | Security hardening or vulnerability fix           |

### Examples

```
feat(tasks): add due-date field to task model
fix(storage): handle QuotaExceededError gracefully
docs(readme): add installation video link
test(filters): add coverage for empty search query
security(dom): replace innerHTML with textContent in task renderer
```

**Rules:**
- Subject line: 72 characters max, lowercase, no trailing period.
- Use the imperative mood: "add feature" not "added feature".
- Reference issues in the footer: `Closes #42`.

---

## Pull Request Process

1. **One concern per PR.** Avoid mixing unrelated changes.
2. **Link the related issue** using `Closes #<issue-number>`.
3. **Ensure all tests pass** before opening the PR:
   ```bash
   npm test
   ```
4. **Fill in the pull request template** completely.
5. **Request a review** from `@MRINALPRAKASHFSD`.
6. **Do not force-push** after a review has started without prior discussion.
7. Maintainers may request changes before merging.
8. PRs are merged by the maintainer via squash merge to keep history clean.

---

## Code Standards

### HTML
- Use semantic elements (`<article>`, `<section>`, `<nav>`, `<main>`, etc.).
- Every interactive element must have an accessible label (`aria-label` or `<label>`).
- All images need `alt` attributes.
- Validate with the W3C Nu HTML Checker if you modify `index.html`.

### CSS
- All new design tokens belong in `css/variables.css`.
- Media query breakpoints must use `css/responsive.css`.
- Do not use `!important` except to override third-party styles.
- Prefer CSS custom properties over hard-coded values.

### JavaScript
- Files are ES modules (`type: "module"` in `package.json`).
- Do not use `eval`, `Function()` constructor or `innerHTML` with unsanitised input.
- Use `textContent` or explicit DOM API methods for user-supplied content.
- Handle `localStorage` errors; do not assume it is always available.
- Write JSDoc comments for all exported functions.
- Separate concerns: `tasks.js` for domain logic, `storage.js` for persistence,
  `filters.js` for filtering/sorting, `utils.js` for shared helpers, `app.js` for the UI.

### General
- Do not introduce runtime dependencies without prior discussion in an issue.
- Keep the zero-dependency philosophy.

---

## Testing

All logic changes require corresponding tests.

```bash
# Run all tests
npm test

# Run individual test files
npm run test:tasks
npm run test:filters
npm run test:storage
```

**Test requirements:**
- Tests use the Node.js built-in test runner (`node:test`).
- Each exported function must have at least one positive and one negative test case.
- Tests must not rely on execution order.
- Tests must not modify shared global state without cleaning up (use `beforeEach`).

---

## Documentation

- Public API changes must update the relevant JSDoc comments.
- User-facing feature changes must update `docs/USER_GUIDE.md`.
- Architecture changes must update `docs/ARCHITECTURE.md`.
- Add an entry to `CHANGELOG.md` in the `[Unreleased]` section.

---

Thank you for contributing to TaskFlow! 🚀
