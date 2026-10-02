import { expect, test } from 'vitest';
import { route, stepPlayer, walkable } from './world';

test('movement keeps analog speed and caps diagonal speed', () => {
  const from = { x: 400, y: 680 };
  const cardinal = stepPlayer(from, { x: 1, y: 0 }, 40, 'square');
  const diagonal = stepPlayer(from, { x: 1, y: 1 }, 40, 'square');
  expect(cardinal).toEqual({ x: 440, y: 680 });
  expect(Math.hypot(diagonal.x - from.x, diagonal.y - from.y)).toBeCloseTo(40);
  expect(stepPlayer(from, { x: .25, y: 0 }, 40, 'square')).toEqual({ x: 410, y: 680 });
  expect(stepPlayer(from, { x: 0, y: 0 }, 40, 'square')).toEqual(from);
  expect(stepPlayer(from, { x: 1, y: 0 }, 0, 'square')).toEqual(from);
});

test('movement slides along the bench without entering it', () => {
  const from = { x: 319, y: 580 };
  const moved = stepPlayer(from, { x: 1, y: 1 }, 40, 'square');
  expect(moved.x).toBe(from.x);
  expect(moved.y).toBeGreaterThan(from.y);
  expect(walkable(moved.x, moved.y, 'square')).toBe(true);
});

test('long movement cannot tunnel through the bench, basket, library or box', () => {
  for (const [from, direction, axis, limit] of [
    [{ x: 280, y: 580 }, { x: 1, y: 0 }, 'x', 320],
    [{ x: 80, y: 600 }, { x: 1, y: 0 }, 'x', 100],
    [{ x: 880, y: 540 }, { x: 1, y: 0 }, 'x', 895],
    [{ x: 1080, y: 680 }, { x: 0, y: 1 }, 'y', 695],
  ] as const) {
    const moved = stepPlayer(from, direction, 350, 'square');
    expect(moved[axis]).toBeLessThanOrEqual(limit);
    expect(walkable(moved.x, moved.y, 'square')).toBe(true);
  }
});

test('movement respects world edges and the bridge ground', () => {
  for (const [from, direction, axis, boundary] of [
    [{ x: 75, y: 680 }, { x: -1, y: 0 }, 'x', 70],
    [{ x: 1135, y: 680 }, { x: 1, y: 0 }, 'x', 1140],
    [{ x: 80, y: 465 }, { x: 0, y: -1 }, 'y', 460],
    [{ x: 400, y: 755 }, { x: 0, y: 1 }, 'y', 760],
  ] as const) {
    expect(stepPlayer(from, direction, 350, 'square')[axis]).toBe(boundary);
  }
  const moved = stepPlayer({ x: 400, y: 600 }, { x: 0, y: -1 }, 350, 'bridge');
  expect(moved).toEqual({ x: 400, y: 590 });
});

test('click routes connect free movement and boundary targets without crossing obstacles', () => {
  for (const [from, to] of [
    [{ x: 729, y: 600 }, { x: 280, y: 680 }],
    [{ x: 728.01, y: 609.9 }, { x: 280, y: 680 }],
    [{ x: 280, y: 680 }, { x: 728, y: 600 }],
    [{ x: 1000, y: 680 }, { x: 1140, y: 760 }],
  ]) {
    const path = route(from, to, 'square');
    expect(path.length).toBeGreaterThan(0);
    expect(path.at(-1)).toEqual(to);
    let previous = from;
    for (const point of path) {
      const samples = Math.max(1, Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y)));
      for (let i = 0; i <= samples; i++) {
        expect(walkable(previous.x + (point.x - previous.x) * i / samples,
          previous.y + (point.y - previous.y) * i / samples, 'square')).toBe(true);
      }
      previous = point;
    }
  }
  expect(route({ x: 280, y: 680 }, { x: 500, y: 500 }, 'square')).toEqual([]);
});

test('click navigation avoids a subpixel crossing at the bench corner', () => {
  const from = { x: 728.01, y: 609.9 }, first = route(from, { x: 280, y: 680 }, 'square')[0];
  expect(first).toBeDefined();
  // If the segment heads left, it must first reach the bench bottom before crossing its right edge.
  if (first.x < 728) {
    const t = (728 - from.x) / (first.x - from.x);
    expect(from.y + (first.y - from.y) * t).toBeGreaterThanOrEqual(610);
  }
});
