/**
 * TaskFlow — tests/organization.test.js
 * Unit tests for Advanced Task Organization:
 * Tags, Subtasks, Notes, Grouping, and enhanced search filtering.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTask,
  updateTask,
  completeTask,
  normaliseTags,
  normaliseSubtasks,
  normaliseNotes,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  getSubtaskProgress,
  addTagToTask,
  removeTagFromTask,
  getAllTags,
} from '../js/tasks.js';
import {
  filterByTag,
  filterBySearch,
  groupTasks,
  applyFilters,
} from '../js/filters.js';

describe('Advanced Task Organization — Tags', () => {
  test('normaliseTags cleans strings, splits commas, and strips hashes', () => {
    assert.deepEqual(normaliseTags('#design, Frontend, , DESIGN'), ['design', 'frontend']);
    assert.deepEqual(normaliseTags(['#WORK', 'personal', 'work']), ['work', 'personal']);
  });

  test('creates task with tags and avoids duplicate tags', () => {
    const task = createTask({ title: 'Task with tags', tags: ['urgent', 'frontend', 'urgent'] });
    assert.deepEqual(task.tags, ['urgent', 'frontend']);
  });

  test('addTagToTask appends clean tag', () => {
    const task = createTask({ title: 'Tag me' });
    const tagged = addTagToTask(task, 'backend');
    assert.deepEqual(tagged.tags, ['backend']);

    // Duplicate tag is ignored
    const duplicate = addTagToTask(tagged, 'backend');
    assert.equal(duplicate.tags.length, 1);
  });

  test('removeTagFromTask removes target tag', () => {
    const task = createTask({ title: 'Untag me', tags: ['alpha', 'beta'] });
    const untagged = removeTagFromTask(task, 'alpha');
    assert.deepEqual(untagged.tags, ['beta']);
  });

  test('getAllTags returns aggregated tag frequency list', () => {
    const tasks = [
      createTask({ title: 'T1', tags: ['work', 'urgent'] }),
      createTask({ title: 'T2', tags: ['work', 'design'] }),
      createTask({ title: 'T3', tags: ['personal'] }),
    ];
    const tags = getAllTags(tasks);
    assert.equal(tags.length, 4);
    assert.equal(tags[0].tag, 'work');
    assert.equal(tags[0].count, 2);
  });

  test('filterByTag filters tasks strictly by tag', () => {
    const tasks = [
      createTask({ title: 'T1', tags: ['feature', 'v1'] }),
      createTask({ title: 'T2', tags: ['bug'] }),
    ];
    const filtered = filterByTag(tasks, 'feature');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].title, 'T1');

    assert.equal(filterByTag(tasks, 'all').length, 2);
  });
});

describe('Advanced Task Organization — Subtasks', () => {
  test('normaliseSubtasks validates objects and strings', () => {
    const subtasks = normaliseSubtasks([
      'Draft outline',
      { title: 'Write intro', completed: true },
      { title: '   ' }, // invalid, should be filtered
    ]);
    assert.equal(subtasks.length, 2);
    assert.equal(subtasks[0].title, 'Draft outline');
    assert.equal(subtasks[0].completed, false);
    assert.equal(subtasks[1].title, 'Write intro');
    assert.equal(subtasks[1].completed, true);
  });

  test('addSubtask appends a new subtask', () => {
    const task = createTask({ title: 'Master task' });
    const withSub = addSubtask(task, 'Step 1');
    assert.equal(withSub.subtasks.length, 1);
    assert.equal(withSub.subtasks[0].title, 'Step 1');
    assert.equal(withSub.subtasks[0].completed, false);
  });

  test('toggleSubtask and deleteSubtask mutate subtask collection correctly', () => {
    const task = createTask({ title: 'Main task', subtasks: ['Sub A', 'Sub B'] });
    const subIdA = task.subtasks[0].id;
    const subIdB = task.subtasks[1].id;

    const toggled = toggleSubtask(task, subIdA);
    assert.equal(toggled.subtasks[0].completed, true);
    assert.equal(toggled.subtasks[1].completed, false);

    const deleted = deleteSubtask(toggled, subIdB);
    assert.equal(deleted.subtasks.length, 1);
    assert.equal(deleted.subtasks[0].id, subIdA);
  });

  test('getSubtaskProgress computes progress ratio and percentage', () => {
    const taskNone = createTask({ title: 'No subtasks' });
    assert.deepEqual(getSubtaskProgress(taskNone), { total: 0, completed: 0, percentage: 0 });

    const taskWithSubs = createTask({
      title: 'Progress task',
      subtasks: [
        { title: 'S1', completed: true },
        { title: 'S2', completed: false },
        { title: 'S3', completed: true },
        { title: 'S4', completed: false },
      ],
    });
    const progress = getSubtaskProgress(taskWithSubs);
    assert.equal(progress.total, 4);
    assert.equal(progress.completed, 2);
    assert.equal(progress.percentage, 50);
  });
});

describe('Advanced Task Organization — Task Notes & Search', () => {
  test('creates and updates task notes', () => {
    const task = createTask({ title: 'Research notes', notes: 'Initial scratchpad' });
    assert.equal(task.notes, 'Initial scratchpad');

    const updated = updateTask(task, { notes: 'Updated notes with markdown link' });
    assert.equal(updated.notes, 'Updated notes with markdown link');
  });

  test('filterBySearch matches on tags, subtasks and notes', () => {
    const tasks = [
      createTask({ title: 'Doc review', notes: 'Discuss architecture trade-offs' }),
      createTask({ title: 'Bug fixing', subtasks: ['Fix Safari memory leak'] }),
      createTask({ title: 'Release prep', tags: ['v2-milestone'] }),
    ];

    assert.equal(filterBySearch(tasks, 'architecture').length, 1);
    assert.equal(filterBySearch(tasks, 'Safari').length, 1);
    assert.equal(filterBySearch(tasks, 'v2-milestone').length, 1);
    assert.equal(filterBySearch(tasks, 'nonexistent').length, 0);
  });
});

describe('Advanced Task Organization — Task Grouping', () => {
  const referenceDate = new Date(2026, 10, 5, 12, 0, 0); // 2026-11-05
  const sampleTasks = [
    createTask({ title: 'High work overdue', priority: 'high', category: 'Work', dueDate: '2026-11-01' }),
    createTask({ title: 'Med work today', priority: 'medium', category: 'Work', dueDate: '2026-11-05' }),
    createTask({ title: 'Low personal future', priority: 'low', category: 'Personal', dueDate: '2026-11-15' }),
    createTask({ title: 'Study no date', priority: 'medium', category: 'Study' }),
  ];

  test('groupTasks by none returns single group', () => {
    const groups = groupTasks(sampleTasks, 'none');
    assert.equal(groups.length, 1);
    assert.equal(groups[0].count, 4);
  });

  test('groupTasks by priority groups into high, medium, low', () => {
    const groups = groupTasks(sampleTasks, 'priority');
    assert.equal(groups.length, 3);
    assert.equal(groups[0].key, 'high');
    assert.equal(groups[0].count, 1);
    assert.equal(groups[1].key, 'medium');
    assert.equal(groups[1].count, 2);
  });

  test('groupTasks by dueDate groups into overdue, today, upcoming, nodate', () => {
    const groups = groupTasks(sampleTasks, 'dueDate', referenceDate);
    assert.equal(groups.length, 4);
    assert.equal(groups.find(g => g.key === 'overdue').count, 1);
    assert.equal(groups.find(g => g.key === 'today').count, 1);
    assert.equal(groups.find(g => g.key === 'upcoming').count, 1);
    assert.equal(groups.find(g => g.key === 'nodate').count, 1);
  });

  test('groupTasks by status groups into pending and completed', () => {
    const withCompleted = [
      ...sampleTasks,
      completeTask(createTask({ title: 'Done task' })),
    ];
    const groups = groupTasks(withCompleted, 'status');
    assert.equal(groups.length, 2);
    assert.equal(groups.find(g => g.key === 'pending').count, 4);
    assert.equal(groups.find(g => g.key === 'completed').count, 1);
  });
});
