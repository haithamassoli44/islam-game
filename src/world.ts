export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 800;
const obstacles = [[320, 0, 728, 610], [895, 0, WORLD_WIDTH, 565], [100, 555, 205, 665], [1040, 695, 1120, WORLD_HEIGHT]];
export const spots: Record<string, { x: number; y: number; label: string }> = {
  friends: { x: 780, y: 620, label: 'أصدقاؤك' },
  rukn: { x: 805, y: 588, label: 'رُكْن' },
  lamha: { x: 980, y: 662, label: 'لَمْحة' },
  wariq: { x: 1070, y: 500, label: 'وَريق' },
  clip0: { x: 540, y: 636, label: 'مشبك تحت المقعد' },
  clip1: { x: 745, y: 615, label: 'مشبك قرب الأصيص' },
  clip2: { x: 340, y: 715, label: 'مشبك بجانب الأوراق' },
  leaves: { x: 145, y: 760, label: 'أوراق في الممر' },
  basket: { x: 152, y: 605, label: 'السلة' },
  box: { x: 1080, y: 700, label: 'علبة وَريق' },
  sign: { x: 820, y: 655, label: 'اللوحة' },
  blocked: { x: 570, y: 723, label: 'وسط الممر' },
  side: { x: 430, y: 595, label: 'بجانب المقعد' },
  gate: { x: 115, y: 485, label: 'إلى الجسر' },
};

export function walkable(x: number, y: number, location: 'square' | 'bridge') {
  if (x < 70 || x > 1140 || y < 460 || y > 760) return false;
  if (location === 'bridge') return y >= 590;
  return !obstacles.some(([left, top, right, bottom]) => x > left && x < right && y > top && y < bottom);
}

// Intersect the entire segment with each open rectangle, including tiny corner crossings.
function clearPath(from: { x: number; y: number }, to: { x: number; y: number }, location: 'square' | 'bridge') {
  if (!walkable(from.x, from.y, location) || !walkable(to.x, to.y, location)) return false;
  if (location === 'bridge') return true;
  const interval = (start: number, end: number, low: number, high: number) => {
    if (start === end) return start > low && start < high ? [-Infinity, Infinity] : [Infinity, -Infinity];
    const a = (low - start) / (end - start), b = (high - start) / (end - start);
    return [Math.min(a, b), Math.max(a, b)];
  };
  return obstacles.every(([left, top, right, bottom]) => {
    const [x0, x1] = interval(from.x, to.x, left, right), [y0, y1] = interval(from.y, to.y, top, bottom);
    return Math.max(0, x0, y0) >= Math.min(1, x1, y1);
  });
}

export function stepPlayer(from: { x: number; y: number }, direction: { x: number; y: number }, distance: number, location: 'square' | 'bridge') {
  const length = Math.max(1, Math.hypot(direction.x, direction.y));
  const steps = Math.max(1, Math.ceil(distance / 5));
  const dx = direction.x / length * distance / steps, dy = direction.y / length * distance / steps;
  let { x, y } = from;
  for (let i = 0; i < steps; i++) {
    if (walkable(x + dx, y, location)) x += dx;
    if (walkable(x, y + dy, location)) y += dy;
  }
  return { x, y };
}

// ponytail: one small fixed walking grid; use a navmesh when scenes need irregular terrain.
export function route(from: { x: number; y: number }, to: { x: number; y: number }, location: 'square' | 'bridge') {
  const size = 40;
  const cell = (p: { x: number; y: number }) => {
    const x = Math.round(p.x / size), y = Math.round(p.y / size);
    return [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => ({ x: x + dx, y: y + dy })))
      .sort((a, b) => Math.hypot(a.x * size - p.x, a.y * size - p.y) - Math.hypot(b.x * size - p.x, b.y * size - p.y))
      .find(c => clearPath(p, { x: c.x * size, y: c.y * size }, location));
  };
  const first = cell(from), last = cell(to);
  if (!first || !last) return [];
  const { x: sx, y: sy } = first, { x: tx, y: ty } = last;
  const key = (x: number, y: number) => `${x},${y}`;
  const start = key(sx, sy), target = key(tx, ty);
  if (!walkable(tx * size, ty * size, location)) return [];
  const queue = [[sx, sy]];
  const visited = new Map<string, string | null>([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (key(x, y) === target) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = key(nx, ny);
      if (walkable(nx * size, ny * size, location) && !visited.has(next)) {
        visited.set(next, key(x, y)); queue.push([nx, ny]);
      }
    }
  }
  if (!visited.has(target)) return [];
  const path: { x: number; y: number }[] = [];
  for (let at: string | null = target; at && at !== start; at = visited.get(at) ?? null) {
    const [x, y] = at.split(',').map(Number); path.unshift({ x: x * size, y: y * size });
  }
  if (from.x !== sx * size || from.y !== sy * size) path.unshift({ x: sx * size, y: sy * size });
  if (to.x !== tx * size || to.y !== ty * size) path.push({ ...to });
  return path;
}
