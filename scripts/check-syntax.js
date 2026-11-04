#!/usr/bin/env node
/**
 * TaskFlow — scripts/check-syntax.js
 * Cross-platform JavaScript syntax validator without external dependencies or shell wildcards.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TARGET_DIRS = ['js', 'tests', 'scripts'];
let hasErrors = false;
let checkedCount = 0;

function walkDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      files.push(fullPath);
    }
  }
  return files;
}

const allJsFiles = TARGET_DIRS.flatMap((dir) => walkDirectory(path.join(rootDir, dir)));

for (const filePath of allJsFiles) {
  const relPath = path.relative(rootDir, filePath);
  const result = spawnSync(process.execPath, ['--check', filePath], {
    encoding: 'utf8',
    cwd: rootDir,
  });

  if (result.status !== 0) {
    console.error(`❌ Syntax error in ${relPath}:\n${result.stderr || result.stdout}`);
    hasErrors = true;
  } else {
    checkedCount++;
  }
}

if (hasErrors) {
  console.error('\nSyntax check failed.');
  process.exit(1);
} else {
  console.log(`✅ Syntax check passed: ${checkedCount} JavaScript file(s) verified.`);
  process.exit(0);
}
