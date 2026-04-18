# User Guide — TaskFlow

> Documentation License: Creative Commons Attribution 4.0 International (CC BY 4.0)

## Getting Started

Open `index.html` in any modern browser. No installation or account is required.
Your tasks are stored privately in your browser's LocalStorage and never sent to a server.

---

## The Interface

### Header
- **TaskFlow logo** — branding and home link.
- **Theme toggle (🌙 / ☀️)** — switches between light and dark themes.

### Sidebar (desktop)
- **All Tasks** — shows every task.
- **Pending** — shows only incomplete tasks.
- **Completed** — shows only finished tasks.
- Each view shows a count badge.

### Dashboard statistics
Four cards show: **Total Tasks**, **Pending**, **Completed** and **High Priority (pending)**.
A progress bar shows the percentage of tasks completed.

### Toolbar
- **Search box** — type to search tasks by title or description.
- **Filter tabs** — All / Pending / Completed.
- **Add Task button** — opens the task creation form.

---

## Managing Tasks

### Add a task
1. Click **Add Task**.
2. Enter a **title** (required, up to 200 characters).
3. Enter an optional **description** (up to 1,000 characters).
4. Choose a **priority**: Low 🟢, Medium 🟡 or High 🔴.
5. Click **Save Task**.

### Edit a task
1. Hover over a task card. The action buttons appear.
2. Click the **✏️ edit** button.
3. Modify the fields in the modal.
4. Click **Save Task**.

### Complete a task
- Click the **circle checkbox** on the left of the task card.
- The task is marked completed, styled with a strikethrough and moved to the bottom.
- Click again to mark it as pending.

### Delete a task
1. Hover over a task card and click the **🗑️ delete** button.
2. A confirmation dialog appears. Click **Delete** to confirm or **Cancel** to abort.

---

## Filtering and Searching

- **Status filter** — use the tabs (All / Pending / Completed) or the sidebar links.
  Your active filter is remembered between sessions.
- **Search** — type in the search box. Results update instantly.
  Search matches against both the title and the description.
  The empty state message changes to explain there are no matching results.

---

## Priorities

| Priority | Colour | Meaning |
|----------|--------|---------|
| 🟢 Low   | Green  | Non-urgent, can wait |
| 🟡 Medium | Yellow | Default; should be addressed soon |
| 🔴 High  | Red    | Urgent; requires immediate attention |

High-priority pending tasks are counted separately in the dashboard.
Tasks are sorted: high-priority pending first, then medium, then low. Completed tasks appear last.

---

## Themes

TaskFlow supports **light** and **dark** themes.
On first visit the theme is set to match your operating system preference.
Click the toggle in the header to override it. Your preference is remembered.

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus to the next interactive element |
| `Shift+Tab` | Move focus to the previous interactive element |
| `Enter` / `Space` | Activate buttons and checkboxes |
| `Escape` | Close any open modal dialog |

---

## Data and Privacy

- All data is stored exclusively in your browser's **LocalStorage**.
- No data is sent to any server or third party.
- Clearing your browser's site data will erase your tasks.
- There is no account, no sync and no cloud backup in v1.0.

---

## Browser Support

TaskFlow is tested on the latest versions of:
- Google Chrome
- Mozilla Firefox
- Apple Safari
- Microsoft Edge

Internet Explorer is not supported.
