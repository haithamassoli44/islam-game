export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 800;
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
  return !(x > 320 && x < 728 && y < 610) && !(x > 895 && y < 565)
    && !(x > 100 && x < 205 && y > 555 && y < 665)
    && !(x > 1040 && x < 1120 && y > 695);
}

// ponytail: one small fixed walking grid; use a navmesh when scenes need irregular terrain.
export function route(from: { x: number; y: number }, to: { x: number; y: number }, location: 'square' | 'bridge') {
  const size = 40;
  const cell = (p: { x: number; y: number }) => [Math.round(p.x / size), Math.round(p.y / size)];
  const [sx, sy] = cell(from), [tx, ty] = cell(to);
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
  return path;
}
