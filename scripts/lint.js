#!/usr/bin/env node
/**
 * TaskFlow — scripts/lint.js
 * Zero-dependency code quality and static style linter.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TARGET_DIRS = ['js', 'tests', 'scripts', 'css'];
let issueCount = 0;
let fileCount = 0;

function walkDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.css'))) {
      files.push(fullPath);
    }
  }
  return files;
}

const filesToCheck = TARGET_DIRS.flatMap((dir) => walkDirectory(path.join(rootDir, dir)));

for (const filePath of filesToCheck) {
  fileCount++;
  const relPath = path.relative(rootDir, filePath);
  const buffer = fs.readFileSync(filePath);

  // Check for UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    console.error(`❌ [BOM] ${relPath}: Contains unexpected Byte Order Mark (BOM).`);
    issueCount++;
  }

  const content = buffer.toString('utf8');
  const lines = content.split(/\r?\n/);

  // Check final newline
  if (content.length > 0 && !content.endsWith('\n')) {
    console.warn(`⚠️ [EOF] ${relPath}: Missing newline at end of file.`);
  }

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Check for debugger statements in JavaScript
    const debuggerRegex = new RegExp('\\b' + 'debugger' + '\\b;?');
    if (filePath.endsWith('.js') && !relPath.startsWith('scripts') && debuggerRegex.test(line)) {
      console.error(`❌ [DEBUGGER] ${relPath}:${lineNum}: debugger statement is not allowed in production code.`);
      issueCount++;
    }

    // Check for direct eval in JavaScript
    const evalRegex = new RegExp('\\b' + 'eval' + '\\s*\\(');
    if (filePath.endsWith('.js') && !relPath.startsWith('scripts') && evalRegex.test(line)) {
      console.error(`❌ [EVAL] ${relPath}:${lineNum}: eval is forbidden for security.`);
      issueCount++;
    }

    // Check for document.write
    const docWriteRegex = new RegExp('\\b' + 'document\\.write' + '\\b');
    if (filePath.endsWith('.js') && !relPath.startsWith('scripts') && docWriteRegex.test(line)) {
      console.error(`❌ [XSS] ${relPath}:${lineNum}: document.write is forbidden for security.`);
      issueCount++;
    }
  });
}

if (issueCount > 0) {
  console.error(`\n❌ Linting failed: ${issueCount} issue(s) detected across ${fileCount} file(s).`);
  process.exit(1);
} else {
  console.log(`✅ Linting passed: ${fileCount} file(s) checked with 0 quality issues.`);
  process.exit(0);
}
