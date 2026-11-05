/**
 * TaskFlow — scripts/audit-contrast.js
 * WCAG 2.2 AA Color Contrast Ratio Verification for Light & Dark Themes.
 * Supports Hex and RGBA blending over underlying surface colors.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

import fs from 'node:fs';

function parseColor(str, surfaceRgb = [255, 255, 255]) {
  if (!str) return null;
  str = str.trim();

  // Hex (#ffffff or #fff)
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length !== 6) return null;
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  // RGBA
  const rgbaMatch = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;

    // Alpha blend over surface
    const blendR = Math.round(r * a + surfaceRgb[0] * (1 - a));
    const blendG = Math.round(g * a + surfaceRgb[1] * (1 - a));
    const blendB = Math.round(b * a + surfaceRgb[2] * (1 - a));
    return [blendR, blendG, blendB];
  }

  return null;
}

function relativeLuminance([r, g, b]) {
  const [sR, sG, sB] = [r, g, b].map((val) => {
    const v = val / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sR + 0.7152 * sG + 0.0722 * sB;
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const css = fs.readFileSync('css/variables.css', 'utf-8');

function extractTokens(selectorRegex) {
  const match = css.match(selectorRegex);
  const tokens = {};
  if (!match) return tokens;
  const lines = match[1].split('\n');
  for (const line of lines) {
    const m = line.match(/--([\w-]+):\s*([^;]+);/);
    if (m) tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

const lightTokens = extractTokens(/:root\s*\{([^}]+)\}/s);
const darkOverrides = extractTokens(/\[data-theme=['"]dark['"]\]\s*\{([^}]+)\}/s);
const darkTokens = { ...lightTokens, ...darkOverrides };

const testCases = [
  // Typography
  { fg: 'color-text-primary',   bg: 'color-bg',          name: 'Primary Text on Base Background' },
  { fg: 'color-text-primary',   bg: 'color-surface',     name: 'Primary Text on Surface Card' },
  { fg: 'color-text-secondary', bg: 'color-bg',          name: 'Secondary Text on Base Background' },
  { fg: 'color-text-secondary', bg: 'color-surface',     name: 'Secondary Text on Surface Card' },
  { fg: 'color-text-muted',     bg: 'color-surface',     name: 'Muted Text on Surface (meta/dates)' },

  // Buttons
  { fgDirect: '#ffffff',        bg: 'color-primary',     name: 'Primary Button Text (white on primary)' },
  { fgDirect: '#ffffff',        bgDirect: '#dc2626',     name: 'Danger Solid Button Text (white on #dc2626)' },

  // Priorities
  { fg: 'color-priority-high-text', bg: 'color-priority-high-bg', name: 'High Priority Badge' },
  { fg: 'color-priority-med-text',  bg: 'color-priority-med-bg',  name: 'Medium Priority Badge' },
  { fg: 'color-priority-low-text',  bg: 'color-priority-low-bg',  name: 'Low Priority Badge' },

  // Categories
  { fg: 'color-cat-work-text',     bg: 'color-cat-work-bg',     name: 'Work Category Badge' },
  { fg: 'color-cat-personal-text', bg: 'color-cat-personal-bg', name: 'Personal Category Badge' },
  { fg: 'color-cat-study-text',    bg: 'color-cat-study-bg',    name: 'Study Category Badge' },
  { fg: 'color-cat-health-text',   bg: 'color-cat-health-bg',   name: 'Health Category Badge' },
  { fg: 'color-cat-finance-text',  bg: 'color-cat-finance-bg',  name: 'Finance Category Badge' },
  { fg: 'color-cat-general-text',  bg: 'color-cat-general-bg',  name: 'General Category Badge' },
];

function runAudit(themeName, tokens, defaultSurfaceHex) {
  console.log(`\n========================================================================`);
  console.log(`  WCAG 2.2 COLOR CONTRAST AUDIT: ${themeName.toUpperCase()} THEME`);
  console.log(`========================================================================`);

  const surfaceRgb = parseColor(tokens['color-surface'] || defaultSurfaceHex);
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  const issues = [];

  for (const item of testCases) {
    const fgRaw = item.fgDirect || tokens[item.fg];
    const bgRaw = item.bgDirect || tokens[item.bg];

    const rgbBg = parseColor(bgRaw, surfaceRgb);
    const rgbFg = parseColor(fgRaw, rgbBg);

    if (!rgbBg || !rgbFg) {
      console.log(`⚠️ Unresolvable tokens: ${item.name}`);
      continue;
    }

    const ratio = getContrastRatio(rgbFg, rgbBg);
    const passAA = ratio >= 4.5;
    const passAALarge = ratio >= 3.0;

    let badge = '❌ FAIL';
    if (passAA) {
      badge = '✅ PASS AA (>= 4.5:1)';
      passCount++;
    } else if (passAALarge) {
      badge = '⚠️ PASS Large (>= 3.0:1)';
      warnCount++;
    } else {
      failCount++;
      issues.push({ name: item.name, ratio, fgRaw, bgRaw });
    }

    console.log(
      `${badge.padEnd(25)} | ${ratio.toFixed(2).padStart(5)}:1 | ${item.name.padEnd(38)} (${fgRaw} on ${bgRaw})`
    );
  }

  console.log(`------------------------------------------------------------------------`);
  console.log(`Result: ${passCount} Passed AA, ${warnCount} Passed Large/UI, ${failCount} Failed.`);
  return issues;
}

const lightIssues = runAudit('Light', lightTokens, '#ffffff');
const darkIssues = runAudit('Dark', darkTokens, '#111827');

if (lightIssues.length > 0 || darkIssues.length > 0) {
  console.log('\nAudit Identified Contrast Remediation Targets:');
  for (const i of lightIssues) console.log(`  - [Light] ${i.name}: ${i.ratio.toFixed(2)}:1 (${i.fgRaw} on ${i.bgRaw})`);
  for (const i of darkIssues) console.log(`  - [Dark]  ${i.name}: ${i.ratio.toFixed(2)}:1 (${i.fgRaw} on ${i.bgRaw})`);
}
