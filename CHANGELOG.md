# Changelog

All notable changes to TaskFlow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
TaskFlow adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Phase 4 Advanced Productivity Engine & Smart Task Management**:
  - **Interactive Calendar Engine (`js/calendar.js`, `tests/calendar.test.js`)**:
    - Full three-tier calendar system supporting Month grid, 7-Day Week view, and Dedicated Day view with hourly agenda and timeline.
    - Month, week, and day navigation across boundaries, leap-year calculations, and localized headers.
    - Dedicated Day View featuring date summary banners, overdue task alerts, all-day task aggregation, and 24-hour timeline slots with task mapping.
    - Date task queries, day task summaries, color-coded priority dots, and day detail inspector.
  - **Recurring Task Engine (`js/recurrence.js`, `tests/recurrence.test.js`)**:
    - Recurrence rules supporting daily, weekly, monthly, and yearly cadences.
    - Leap-year aware date calculation honoring month length boundaries and weekday preservation.
    - Automated occurrence scheduling on task completion with duplicate prevention.
  - **Productivity Analytics Engine (`js/analytics.js`, `tests/analytics.test.js`)**:
    - Comprehensive metrics: total, completed, pending, completion rate percentage, overdue count, and average tasks per day.
    - Time-frame filtering across 7-day, 30-day, 90-day, and all-time spans.
    - Daily completion trend analysis with zero-dependency responsive SVG bar chart generation.
    - Category completion rates with visual progress bars and priority distribution metrics.
    - Qualitative, data-driven productivity insights highlighting peak performance days and momentum.
  - **Smart Reminders Engine (`js/reminders.js`, `tests/reminders.test.js`)**:
    - Proactive due-soon and overdue task detection.
    - Time-specific reminder scheduling (`reminderTime`).
    - Web Notification API dispatch with graceful fallback to in-app toast notifications.
    - LocalStorage deduplication registry preventing duplicate alerts.
    - Configurable settings for due-soon thresholds (12h, 24h, 48h) and notification permissions.
  - **Advanced Task Organization (`js/tasks.js`, `js/filters.js`, `tests/organization.test.js`)**:
    - Multi-tag classification: normalized tag chips on cards with real-time tag filtering.
    - Subtask checklists: itemized checklist buffer in modal with progress tracker (`0/N`) on cards.
    - Extended task notes: multiline note support with character counter and collapsible notes accordion.
    - Dynamic task grouping: group tasks on the fly by Priority, Status, Category, or Due Date.
  - **Command Palette (`js/palette.js`, `tests/palette.test.js`)**:
    - Quick action dialog opened via `⌘K` / `Ctrl+K` or header button.
    - Real-time command search across navigation, filters, themes, and settings.
    - Full keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`).
    - Strict ARIA combobox pattern with dynamic `aria-activedescendant`.
  - **UI Integration & Multi-View Architecture (`index.html`, `css/styles.css`, `css/responsive.css`, `js/app.js`)**:
    - Primary multi-view navigation in sidebar: Dashboard, Calendar, and Analytics.
    - Mobile responsive drawer updated to support multi-view switching.
    - Expanded automated test coverage from 131 to 209 unit tests across 55 suites (100% pass rate).
    - Expanded browser test suite from 18 to 26 verified interaction workflows, including dedicated Day View verification.

- **Phase 3 & 3.1 Premium UI/UX Redesign, Design System & Responsive Experience**:
  - **Design System Tokens (`css/variables.css`)**: Expanded design tokens for light and dark palettes including electric iris brand gradients, dark-mode elevated surfaces, multi-layer shadows, 4px spacing scale, and priority text/bg/border tokens.
  - **Complete SVG Icon Factory (`js/icons.js`)**: Replaced interface emojis with a zero-dependency, accessible SVG icon factory producing consistent 16x16 and 24x24 icons across task cards, modals, sidebar, toasts, and controls.
  - **Desktop Dashboard & Micro-Interactions (`css/styles.css`, `index.html`)**: Refined dashboard with lift animations on cards, smooth checkbox animations, custom chevron select wrappers, quick `/` search shortcut, `n`/`N` quick add shortcut, and local user chip.
  - **Character Counters**: Added real-time character limit indicators for task title (`0/200`) and description (`0/1000`) in the task modal dialog.
  - **Comprehensive Responsive Layout (`css/responsive.css`)**: Full coverage for 320px, 375px, 768px, 1024px, 1440px, and 1920px viewports, featuring mobile drawer navigation and bottom-sheet presentation for modals.
  - **SVG Icon Unit Tests (`tests/icons.test.js`)**: Added automated unit test suite for the icon factory, expanding total passing test coverage to 131 tests across 29 suites.
  - **Headless Chrome Browser Verification**: Verified across multiple viewports and captured genuine screenshots into `assets/screenshots/`.

- **Phase 2.1 Security, Accessibility & Quality Hardening**:
  - **Hardened JSON Import**: `importAppStateJSON()` transactionally validates root structures, checks schema versions, detects and rejects duplicate task IDs, validates preferences, and protects existing data from being overwritten on failure.
  - **Modal Focus Management & Trapping**: Added `trapFocus` utility cycling `Tab` and `Shift + Tab` inside active modals, hierarchical `Escape` handling, and focus restoration to invoking elements upon close.
  - **Background Inert Management**: Dynamically sets `aria-hidden="true"` on `.app-layout` during modal activation to prevent background interaction.
  - **Cross-Platform Syntax Validation**: Added `scripts/check-syntax.js` to reliably check all JavaScript and test files without shell wildcards.
  - **Zero-Dependency Static Linter**: Added `scripts/lint.js` replacing the placeholder lint command with real static checks for BOM, trailing whitespace, and forbidden constructs.
  - **Accessibility Test Suite**: Added `tests/accessibility.test.js` validating `FOCUSABLE_SELECTOR`, focusable element extraction, and Tab/Shift+Tab focus trapping.
  - **Repository Metadata Alignment**: Standardized package URLs, bug report targets, and documentation links to the actual repository name `task_flow`.

- **Phase 2 Application Architecture & Features**:
  - **Extended Task Data Model**: Added `category` (`Work`, `Personal`, `Study`, `Health`, `Finance`, `General`), `dueDate` (standardized `YYYY-MM-DD`), and synchronized `completed` boolean property.
  - **New Productivity Views**: Added sidebar views for **Today** (tasks due current day), **Upcoming** (tasks due in future), **Overdue** (pending tasks past deadline), and **High Priority**.
  - **Category System**: Added color-coded category dots, category tags on task cards, category filtering dropdown in toolbar, and category navigation with real-time pending counters in the sidebar.
  - **Contextual Due Date Badges**: Added visual due date indicators with distinct styles for "Overdue", "Today", "Tomorrow", and formatted upcoming dates.
  - **Multi-Field Search & Clear**: Enhanced real-time search to query task title, description, and category simultaneously, and added an instant clear (`×`) button in the search field.
  - **Multi-Criteria Sorting**: Implemented 5 deterministic sorting options: *Newest first*, *Oldest first*, *Priority*, *Due date*, and *Recently updated*.
  - **Enhanced Dashboard Statistics**: Added **Overdue Tasks** metric card, dynamic time-aware greeting (*Good morning / afternoon / evening*), and formatted localized header date.
  - **Versioned Storage & Migration Engine**: Implemented `taskflow_data` with schema versioning (`version: 1`), task record validation (`validateTaskRecord`, `cleanseTaskList`), automatic migration of legacy Phase 1 keys, and in-memory fallback.
  - **Mobile Responsive Drawer**: Added hamburger menu button in header and animated slide-out navigation drawer with backdrop overlay for tablet and mobile devices.
  - **Settings & Data Management**: Added accessible Settings modal with offline JSON backup export (`exportAppStateJSON`), validated import (`importAppStateJSON`), clear completed tasks, and data reset.
  - **Comprehensive Unit Testing**: Expanded test coverage from 72 to 112 tests across 27 suites, covering all Phase 2 features and edge cases.
  - **Code Quality Script**: Added `npm run check` script running syntax checks across all JS/test files and executing test runner.

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

[Unreleased]: https://github.com/MRINALPRAKASHFSD/task_flow/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/MRINALPRAKASHFSD/task_flow/releases/tag/v1.0.0
