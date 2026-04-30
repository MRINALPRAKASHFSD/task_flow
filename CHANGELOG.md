# Changelog

All notable changes to TaskFlow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
TaskFlow adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

*(Changes staged for the next release appear here.)*

---

## [1.0.0] — 2026-11-03

### Added

- **Task management** — create, edit, delete and toggle tasks between pending and completed.
- **Priority levels** — Low, Medium and High, with a colour-coded left-edge stripe on each task card.
- **Dashboard statistics** — total, pending, completed and high-priority pending counts with a completion progress bar.
- **Filter tabs** — All, Pending and Completed views.
- **Search** — real-time search by title and description with debouncing.
- **LocalStorage persistence** — tasks, theme preference and active filter are persisted across sessions with full error handling.
- **Task timestamps** — `createdAt` and `updatedAt` fields with human-readable relative time display.
- **Light and Dark themes** — respects the OS preference on first visit; persists user override.
- **Responsive design** — adapts from mobile (320 px) to large desktop (1280 px+).
- **Accessible keyboard navigation** — skip link, focus management, `aria-*` attributes, `role` attributes throughout.
- **Empty states** — context-sensitive messages for no tasks, no search results, no pending and no completed.
- **Form validation** — client-side validation with accessible inline error messages.
- **Confirmation dialog** — prevents accidental deletion with a modal confirmation prompt.
- **Toast notifications** — non-blocking feedback for create, update, delete and storage errors.
- **Modular JavaScript** — `app.js`, `storage.js`, `tasks.js`, `filters.js`, `utils.js`.
- **Unit tests** — 72 tests across task logic, filter logic and storage using the Node.js built-in test runner.
- **GitHub Actions CI** — runs tests on every push and pull request.
- **GitHub Actions CodeQL** — static security analysis for JavaScript.
- **GitHub Actions Stale** — automatically marks stale issues and pull requests.
- **Dependabot** — automated version updates for GitHub Actions and npm.
- **Issue templates** — Bug report, Feature request and Question forms.
- **Pull request template** — standardised contribution checklist.
- **CODEOWNERS** — assigns review responsibility to `@MRINALPRAKASHFSD`.
- **MIT License** for application source code.
- **CC BY 4.0** for documentation.
- **CONTRIBUTING.md**, **CODE_OF_CONDUCT.md**, **SECURITY.md**, **SUPPORT.md**, **GOVERNANCE.md**.
- **AUTHORS.md**, **ROADMAP.md**, **THIRD_PARTY_NOTICES.md**, **NOTICE**.

[Unreleased]: https://github.com/MRINALPRAKASHFSD/taskflow/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/MRINALPRAKASHFSD/taskflow/releases/tag/v1.0.0
