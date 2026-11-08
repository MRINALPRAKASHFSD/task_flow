/**
 * TaskFlow — icons.js
 * SVG Icon Factory for consistent, dependency-free UI iconography.
 *
 * Copyright (c) 2026 Mrinal Prakash
 * SPDX-License-Identifier: MIT
 */

'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create a base SVG element with standard accessibility and stroke attributes.
 *
 * @param {number} [width=16]
 * @param {number} [height=16]
 * @param {string} [viewBox='0 0 24 24']
 * @param {string} [extraClass='']
 * @returns {SVGElement|null}
 */
export function createSvg(width = 16, height = 16, viewBox = '0 0 24 24', extraClass = '') {
  if (typeof document === 'undefined') return null;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('tf-icon');
  if (extraClass) {
    extraClass.split(' ').filter(Boolean).forEach((cls) => svg.classList.add(cls));
  }
  return svg;
}

function appendPath(svg, d, strokeWidth) {
  if (!svg) return;
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  if (strokeWidth) path.setAttribute('stroke-width', String(strokeWidth));
  svg.appendChild(path);
  return path;
}

function appendCircle(svg, cx, cy, r) {
  if (!svg) return;
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', String(cx));
  circle.setAttribute('cy', String(cy));
  circle.setAttribute('r', String(r));
  svg.appendChild(circle);
  return circle;
}

function appendRect(svg, x, y, width, height, rx = 0) {
  if (!svg) return;
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(width));
  rect.setAttribute('height', String(height));
  if (rx) rect.setAttribute('rx', String(rx));
  svg.appendChild(rect);
  return rect;
}

function appendLine(svg, x1, y1, x2, y2) {
  if (!svg) return;
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', String(x1));
  line.setAttribute('y1', String(y1));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
  svg.appendChild(line);
  return line;
}

export function createEditIcon(size = 14, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendPath(svg, 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7');
  appendPath(svg, 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z');
  return svg;
}

export function createDeleteIcon(size = 14, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendPath(svg, 'M3 6h18');
  appendPath(svg, 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2');
  appendPath(svg, 'M10 11v6');
  appendPath(svg, 'M14 11v6');
  return svg;
}

export function createCheckIcon(size = 14, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendPath(svg, 'M20 6L9 17l-5-5');
  return svg;
}

export function createCalendarIcon(size = 13, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendRect(svg, 3, 4, 18, 18, 2);
  appendLine(svg, 16, 2, 16, 6);
  appendLine(svg, 8, 2, 8, 6);
  appendLine(svg, 3, 10, 21, 10);
  return svg;
}

export function createAlertIcon(size = 13, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendCircle(svg, 12, 12, 10);
  appendLine(svg, 12, 8, 12, 12);
  appendLine(svg, 12, 16, 12.01, 16);
  return svg;
}

export function createClockIcon(size = 13, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendCircle(svg, 12, 12, 10);
  appendPath(svg, 'M12 6v6l4 2');
  return svg;
}

export function createFlameIcon(size = 13, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendPath(svg, 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z');
  return svg;
}

export function createSunIcon(size = 16, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendCircle(svg, 12, 12, 5);
  appendLine(svg, 12, 1, 12, 3);
  appendLine(svg, 12, 21, 12, 23);
  appendLine(svg, 4.22, 4.22, 5.64, 5.64);
  appendLine(svg, 18.36, 18.36, 19.78, 19.78);
  appendLine(svg, 1, 12, 3, 12);
  appendLine(svg, 21, 12, 23, 12);
  appendLine(svg, 4.22, 19.78, 5.64, 18.36);
  appendLine(svg, 18.36, 5.64, 19.78, 4.22);
  return svg;
}

export function createMoonIcon(size = 16, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendPath(svg, 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z');
  return svg;
}

export function createPlusIcon(size = 14, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendLine(svg, 12, 5, 12, 19);
  appendLine(svg, 5, 12, 19, 12);
  return svg;
}

export function createSearchIcon(size = 16, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendCircle(svg, 11, 11, 8);
  appendLine(svg, 21, 21, 16.65, 16.65);
  return svg;
}

export function createCloseIcon(size = 16, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendLine(svg, 18, 6, 6, 18);
  appendLine(svg, 6, 6, 18, 18);
  return svg;
}

export function createSettingsIcon(size = 16, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendCircle(svg, 12, 12, 3);
  appendPath(svg, 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z');
  return svg;
}

export function createToastSuccessIcon(size = 18, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendCircle(svg, 12, 12, 10);
  appendPath(svg, 'M9 12l2 2 4-4');
  return svg;
}

export function createToastErrorIcon(size = 18, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendCircle(svg, 12, 12, 10);
  appendLine(svg, 15, 9, 9, 15);
  appendLine(svg, 9, 9, 15, 15);
  return svg;
}

export function createToastInfoIcon(size = 18, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendCircle(svg, 12, 12, 10);
  appendLine(svg, 12, 16, 12, 12);
  appendLine(svg, 12, 8, 12.01, 8);
  return svg;
}

export function createToastWarningIcon(size = 18, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendPath(svg, 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z');
  appendLine(svg, 12, 9, 12, 13);
  appendLine(svg, 12, 17, 12.01, 17);
  return svg;
}

export function createToastCloseIcon(size = 14, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendLine(svg, 18, 6, 6, 18);
  appendLine(svg, 6, 6, 18, 18);
  return svg;
}

export function createBellIcon(size = 18, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendPath(svg, 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9');
  appendPath(svg, 'M13.73 21a2 2 0 0 1-3.46 0');
  return svg;
}

export function createEmptyClipboardIcon(size = 48, className = '') {
  const svg = createSvg(size, size, '0 0 24 24', className);
  appendPath(svg, 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2');
  appendRect(svg, 8, 2, 8, 4, 1);
  appendLine(svg, 9, 12, 15, 12);
  appendLine(svg, 9, 16, 13, 16);
  return svg;
}

export function createPriorityDot(priority = 'medium', size = 8) {
  if (typeof document === 'undefined') return null;
  const span = document.createElement('span');
  span.className = `priority-dot priority-dot--${priority}`;
  span.setAttribute('aria-hidden', 'true');
  return span;
}
