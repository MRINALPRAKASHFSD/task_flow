/**
 * TaskFlow — tests/palette.test.js
 * Unit tests for Command Palette engine:
 * search filtering, keyboard triggers, selection cycling, execution, and state management.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COMMANDS,
  filterCommands,
  createCommandPalette,
  isPaletteTriggerEvent,
} from '../js/palette.js';

describe('Command Palette — Default Commands & Filtering', () => {
  test('DEFAULT_COMMANDS contains core navigation and action entries', () => {
    assert.ok(DEFAULT_COMMANDS.length >= 7);
    const ids = DEFAULT_COMMANDS.map(c => c.id);
    assert.ok(ids.includes('nav-dashboard'));
    assert.ok(ids.includes('nav-calendar'));
    assert.ok(ids.includes('nav-analytics'));
    assert.ok(ids.includes('action-create-task'));
    assert.ok(ids.includes('action-toggle-theme'));
  });

  test('filterCommands returns all commands when query is empty', () => {
    const list = filterCommands(DEFAULT_COMMANDS, '');
    assert.equal(list.length, DEFAULT_COMMANDS.length);
  });

  test('filterCommands matches by title and category', () => {
    const calMatches = filterCommands(DEFAULT_COMMANDS, 'calendar');
    assert.ok(calMatches.length >= 1);
    assert.equal(calMatches[0].id, 'nav-calendar');

    const settingMatches = filterCommands(DEFAULT_COMMANDS, 'Settings');
    assert.ok(settingMatches.some(c => c.category === 'Settings'));
  });

  test('filterCommands matches by keywords and shortcuts', () => {
    const todoMatches = filterCommands(DEFAULT_COMMANDS, 'todo');
    assert.ok(todoMatches.some(c => c.id === 'action-create-task'));

    const shortcutMatches = filterCommands(DEFAULT_COMMANDS, 'G C');
    assert.ok(shortcutMatches.some(c => c.id === 'nav-calendar'));
  });
});

describe('Command Palette — Controller & State Machine', () => {
  test('handles open, close, and query updates', () => {
    let closed = false;
    const palette = createCommandPalette({
      onClose: () => { closed = true; },
    });

    assert.equal(palette.isOpen(), false);
    palette.open();
    assert.equal(palette.isOpen(), true);
    assert.equal(palette.getQuery(), '');

    palette.setQuery('analytics');
    assert.equal(palette.getQuery(), 'analytics');
    const filtered = palette.getFilteredCommands();
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'nav-analytics');

    palette.close();
    assert.equal(palette.isOpen(), false);
    assert.equal(closed, true);
  });

  test('cycles selection with selectNext and selectPrevious', () => {
    const palette = createCommandPalette();
    palette.open();

    const count = palette.getFilteredCommands().length;
    assert.equal(palette.getSelectedIndex(), 0);

    palette.selectNext();
    assert.equal(palette.getSelectedIndex(), 1);

    palette.selectPrevious();
    assert.equal(palette.getSelectedIndex(), 0);

    // Wraps around to bottom
    palette.selectPrevious();
    assert.equal(palette.getSelectedIndex(), count - 1);

    // Wraps around to top
    palette.selectNext();
    assert.equal(palette.getSelectedIndex(), 0);
  });

  test('executes selected command and dispatches onSelect callback', () => {
    let handlerExecuted = false;
    let selectedPayload = null;

    const customCommand = {
      id: 'test-cmd',
      title: 'Run Test Command',
      category: 'Actions',
      handler: () => { handlerExecuted = true; },
    };

    const palette = createCommandPalette({
      commands: [customCommand],
      onSelect: (cmd) => { selectedPayload = cmd; },
    });

    palette.open();
    const executed = palette.executeSelected();

    assert.equal(executed.id, 'test-cmd');
    assert.equal(handlerExecuted, true);
    assert.equal(selectedPayload.id, 'test-cmd');
    assert.equal(palette.isOpen(), false);
  });
});

describe('Command Palette — Keyboard Trigger Detection', () => {
  test('isPaletteTriggerEvent detects Cmd+K on Mac and Ctrl+K on Windows', () => {
    assert.equal(isPaletteTriggerEvent({ key: 'k', metaKey: true }), true);
    assert.equal(isPaletteTriggerEvent({ key: 'K', ctrlKey: true }), true);
    assert.equal(isPaletteTriggerEvent({ key: 'k', metaKey: false, ctrlKey: false }), false);
    assert.equal(isPaletteTriggerEvent({ key: 'k', metaKey: true, altKey: true }), false);
    assert.equal(isPaletteTriggerEvent(null), false);
  });
});

