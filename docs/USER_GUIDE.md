# User Guide — TaskFlow

> Documentation License: Creative Commons Attribution 4.0 International (CC BY 4.0)
> See `LICENSE-CC-BY-4.0` in this directory.

Welcome to **TaskFlow** — *Plan smarter. Stay organized. Get things done.*

TaskFlow is a fast, lightweight, and modern productivity dashboard designed to keep your work organized without bloated dependencies, cloud tracking, or mandatory logins.

---

## Getting Started

1. Open `index.html` in any modern web browser, or run `npm start` to serve locally at `http://localhost:8080`.
2. No signup or account configuration is required.
3. All tasks and settings are persisted securely in your browser's `localStorage` and never transmit data across the internet.

---

## Workspace Layout

### Desktop Productivity Dashboard

- **Header**:
  - **Mobile Menu Toggle**: Visible on tablet and mobile viewports.
  - **TaskFlow Brand**: Logo with productivity check icon.
  - **Quick Add Task Button**: Fast action button for rapid task entry.
  - **Theme Toggle (🌙 / ☀️)**: Switch between Light and Dark themes.

- **Sidebar Navigation**:
  - **Views**:
    - **All Tasks**: Complete collection of tasks.
    - **Today**: Tasks with a due date matching the current calendar day.
    - **Upcoming**: Tasks due in the future.
    - **Overdue**: Incomplete tasks whose due dates have passed.
    - **Completed**: Finished tasks with strikethrough styling.
  - **Categories**:
    - **All Categories**, **Work**, **Personal**, **Study**, **Health**, **Finance**, and **General**.
    - Each category item displays a color-coded indicator and real-time pending task counter.

- **Main Content Area**:
  - **Welcome Header**: Time-aware greeting (Good morning / afternoon / evening) and formatted local date.
  - **Dashboard Metrics**:
    - **Total Tasks**: Aggregate task volume.
    - **Pending Tasks**: Work awaiting completion.
    - **Completed Tasks**: Finished tasks.
    - **Overdue Tasks**: Work that requires urgent rescheduling.
    - **High Priority**: Pending critical items.
    - **Progress Bar**: Live completion rate calculation.
  - **Interactive Toolbar**:
    - **Search Box**: Instant filter searching title, description, and category. Includes a quick clear (`×`) button.
    - **Category Selector**: Dropdown to narrow tasks by category.
    - **Sort Control**: Dynamic sorting dropdown.
    - **Filter Tabs**: Quick toggle between All, Pending, and Completed.
    - **Add Task Button**: Opens full task creation dialog.
  - **Task List**: Responsive cards with status checkboxes, priority badges, category tags, due date badges, and action controls.

---

## Task Management Operations

### 1. Creating a Task
1. Click **+ Add Task** in the toolbar or header.
2. Enter a **Task Title** (required, 1–200 characters).
3. Optionally enter a **Description** (up to 1,000 characters).
4. Select a **Priority**:
   - 🟢 **Low**: Routine or non-urgent items.
   - 🟡 **Medium**: Standard priority (default).
   - 🔴 **High**: Critical tasks requiring immediate attention.
5. Select a **Category**:
   - `Work`, `Personal`, `Study`, `Health`, `Finance`, or `General`.
6. Optionally set a **Due Date** using the calendar picker (`YYYY-MM-DD`).
7. Click **Save Task** or press `Enter`.

### 2. Editing a Task
1. Hover or focus on any task card and click the **✏️ Edit** button.
2. Update the title, description, priority, category, or due date.
3. Click **Save Task**. Your changes are saved immediately and timestamps updated.

### 3. Completing and Reopening Tasks
- Click the circular checkbox on the left of any task card.
- The task instantly toggles to **Completed**, visual strikethrough is applied, and the dashboard progress bar updates in real time.
- Clicking the checkbox on a completed task reopens it as **Pending**.

### 4. Deleting a Task
1. Click the **🗑️ Delete** button on the task card.
2. An accessible confirmation dialog asks for confirmation.
3. Click **Delete** to confirm permanent removal, or **Cancel** to abort.

---

## Filtering, Searching & Sorting

### Filtering by View
- Select **All Tasks**, **Today**, **Upcoming**, **Overdue**, or **Completed** in the sidebar.
- Use the quick status tabs (**All**, **Pending**, **Completed**) in the toolbar.
- The active view is remembered across browser sessions.

### Category Filtering
- Use the sidebar category list or the toolbar category dropdown to view tasks in specific areas of life or work.

### Real-Time Search
- Type into the search input. Results update immediately as you type.
- Matches against:
  - Task title
  - Task description
  - Category name
- Click the clear button (`×`) inside the search box or press `Escape` to reset the search query.

### Sorting Options
Switch between 5 sorting strategies via the Sort dropdown:
1. **Newest first**: Most recently created tasks at the top.
2. **Oldest first**: Earliest created tasks first.
3. **Priority**: High-priority tasks first, followed by medium and low.
4. **Due date**: Earliest due dates first; tasks with deadlines precede tasks without deadlines.
5. **Recently updated**: Tasks modified most recently appear first.

---

## Keyboard Shortcuts & Accessibility

| Key Combination | Action |
|---|---|
| `Tab` | Advance focus to next interactive element |
| `Shift + Tab` | Move focus to previous interactive element |
| `Enter` / `Space` | Toggle checkboxes, open modals, trigger buttons |
| `Escape` | Dismiss open dialogs, clear search input, or close mobile drawer |

- **Skip Navigation**: Press `Tab` upon initial page load to reveal the "Skip to main content" link.
- **Screen Reader Announcements**: An `aria-live="polite"` announcer reports task additions, deletions, completions, and filter transitions.
- **High Contrast**: Fully compatible with Windows High Contrast Mode (`forced-colors: active`).
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce` settings.

---

## Settings & Data Management

Access the Settings modal by clicking **⚙️ Settings** in the sidebar.

- **Theme Preferences**: Switch between Light and Dark themes anytime.
- **Export Tasks (JSON)**: Download a local timestamped backup of your tasks (`taskflow-backup-YYYY-MM-DD.json`).
- **Import Tasks (JSON)**: Restore tasks from a previously saved backup file.
  - Files are defensively checked: empty JSON, unsupported versions, duplicate task IDs, and malformed files are safely rejected.
  - Your existing tasks are protected and preserved if an imported file fails validation.
- **Clear Completed Tasks**: Remove all completed tasks while keeping pending work intact. Requires confirmation.
- **Reset All Tasks**: Clear all tasks and reset your dashboard back to an empty state. Requires confirmation.

---

## Data Privacy, Offline Storage & Limitations

- **Local Storage Only**: All TaskFlow data is saved locally in your browser's `localStorage`.
- **No Remote Tracking**: No tracking cookies, external analytics, or remote API queries are executed.
- **Device & Browser Isolation**: Tasks are stored within your specific browser profile. To transfer tasks to another device or browser, export a JSON backup and import it on the target system.
- **Storage Quota**: Web browsers allocate limited storage (typically around 5MB) per website origin. For typical task lists this is more than sufficient, but exporting periodic JSON backups is strongly recommended before clearing browser data.
