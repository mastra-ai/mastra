/** App-owned vector artwork. All scenes share the same surface count so their geometry can morph. */
export const DRAWING_SURFACE_COUNT = 8;
export type Point = readonly [number, number];
type WorldPoint = readonly [number, number, number];
export type DrawingScene = 'factory' | 'codebase' | 'intake' | 'accounts';
export type AccountsMode = 'shared' | 'individual' | 'hybrid';
export interface Surface {
  opacity?: number;
  outline: Point[];
  marks: Point[];
}
export interface DrawingPose {
  surfaces: Surface[];
  links: Point[][];
  building: number;
  scale: number;
  x: number;
  y: number;
  foundation: number;
}

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const value = Math.max(0, Math.min(1, t));
  return value * value * (3 - 2 * value);
};
export const pointBetween = (a: Point, b: Point, t: number): Point => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
export const project = ([x, y, z]: WorldPoint): Point => [209 + (x - y) * 0.884, 213 + (x + y) * 0.442 - z * 1.25];
export const polygon = (points: readonly Point[]) =>
  points.length ? `M${points.map(p => p.join(',')).join('L')}Z` : '';
/** Smooth the sampled contour so small rounded corners never become visible polygon facets. */
export const contour = (points: readonly Point[]) => {
  const midpoint = (index: number) => pointBetween(points[index], points[(index + 1) % points.length], 0.5);
  return `M${midpoint(points.length - 1).join(',')}${points
    .map((point, index) => `Q${point.join(',')} ${midpoint(index).join(',')}`)
    .join('')}Z`;
};
export const segments = (points: readonly Point[]) => {
  let path = '';
  for (let i = 0; i + 1 < points.length; i += 2) {
    if (Math.hypot(points[i][0] - points[i + 1][0], points[i][1] - points[i + 1][1]) > 0.01)
      path += `M${points[i].join(',')}L${points[i + 1].join(',')}`;
  }
  return path;
};
export const curve = (points: readonly Point[]) =>
  `M${points[0].join(',')}C${points
    .slice(1)
    .map(p => p.join(','))
    .join(' ')}`;
export function onCurve(points: readonly Point[], t: number): Point {
  const a = pointBetween(points[0], points[1], t);
  const b = pointBetween(points[1], points[2], t);
  const c = pointBetween(points[2], points[3], t);
  return pointBetween(pointBetween(a, b, t), pointBetween(b, c, t), t);
}

function hull(points: readonly Point[]): Point[] {
  const sorted = points.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (input: Point[]) => {
    const result: Point[] = [];
    for (const p of input) {
      while (result.length > 1) {
        const a = result[result.length - 2],
          b = result[result.length - 1];
        if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 0) break;
        result.pop();
      }
      result.push(p);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.toReversed())];
}

function rounded(points: readonly Point[], radius: number): Point[] {
  return points.flatMap((p, i) => {
    const previous = points[(i + points.length - 1) % points.length],
      next = points[(i + 1) % points.length];
    const inset = (toward: Point) =>
      pointBetween(p, toward, Math.min(0.45, radius / (Math.hypot(toward[0] - p[0], toward[1] - p[1]) || 1)));
    const a = inset(previous),
      b = inset(next);
    return Array.from({ length: 5 }, (_, j) =>
      pointBetween(pointBetween(a, p, j / 4), pointBetween(p, b, j / 4), j / 4),
    );
  });
}

/** Equal perimeter samples make arbitrary outlines compatible without a path-morph dependency. */
function surface(vertices: readonly Point[], marks: Point[] = [], radius = 1.5): Surface {
  // Consistent winding and origin prevent surfaces twisting as their outlines change.
  const signedArea = vertices.reduce(
    (area, p, i) =>
      area + p[0] * vertices[(i + 1) % vertices.length][1] - p[1] * vertices[(i + 1) % vertices.length][0],
    0,
  );
  const ordered = signedArea < 0 ? vertices.toReversed() : [...vertices];
  const first = ordered.reduce(
    (best, point, i) => (point[0] + point[1] < ordered[best][0] + ordered[best][1] ? i : best),
    0,
  );
  const points = rounded([...ordered.slice(first), ...ordered.slice(0, first)], radius);
  const lengths = points.map((p, i) =>
    Math.hypot(p[0] - points[(i + 1) % points.length][0], p[1] - points[(i + 1) % points.length][1]),
  );
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  const outline = Array.from({ length: 64 }, (_, i): Point => {
    let remaining = (perimeter * i) / 64;
    for (let edge = 0; edge < lengths.length; edge++) {
      if (remaining <= lengths[edge])
        return pointBetween(points[edge], points[(edge + 1) % points.length], remaining / (lengths[edge] || 1));
      remaining -= lengths[edge];
    }
    return points[0];
  });
  return { outline, marks: Array.from({ length: 8 }, (_, i) => marks[i] ?? vertices[0]) };
}
export function panel(x: number, y: number, width: number, height: number, marked = false): Surface {
  const marks: Point[] = marked
    ? [
        [x + 10, y + 14],
        [x + width * 0.6, y + 14],
        [x + 10, y + 22],
        [x + width * 0.4, y + 22],
      ]
    : [];
  return surface(
    [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ],
    marks,
    8,
  );
}
const folded = panel(200, 175, 0, 0);

function withFoldedSurfaces(surfaces: Surface[]): Surface[] {
  return [...surfaces, ...Array.from({ length: DRAWING_SURFACE_COUNT - surfaces.length }, () => folded)];
}
const worldLine = (a: WorldPoint, b: WorldPoint): Point[] => [project(a), project(b)];
const worldPolygon = (points: WorldPoint[]) => polygon(points.map(project));
function box(
  x: number,
  y: number,
  width: number,
  depth: number,
  z: number,
  height: number,
  flushAt: (corner: WorldPoint) => boolean = () => false,
) {
  const corners: WorldPoint[] = [
    [x, y, z],
    [x + width, y, z],
    [x + width, y + depth, z],
    [x, y + depth, z],
  ];
  const vertices = [...corners, ...corners.map(([u, v, w]): WorldPoint => [u, v, w + height])];
  const square = new Set(vertices.filter(flushAt).map(corner => project(corner).join()));
  const top = z + height;
  const crease = (from: WorldPoint, to: WorldPoint) => {
    const roundingInset = (corner: WorldPoint) =>
      flushAt(corner) ? 0 : 2 / Math.hypot(to[0] - from[0], to[1] - from[1]);
    const along = (t: number): WorldPoint => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, top];
    return worldLine(along(roundingInset(from)), along(1 - roundingInset(to)));
  };
  return {
    silhouette: hull(vertices.map(project)),
    flushCorners: square,
    creaseCorner: project([x + width, y + depth, top]),
    creases: [
      ...crease([x, y + depth, top], [x + width, y + depth, top]),
      ...crease([x + width, y, top], [x + width, y + depth, top]),
    ],
  };
}
function slab(x: number, y: number, width: number, depth: number, z: number, height: number, marked = true): Surface {
  const { silhouette, creases } = box(x, y, width, depth, z, height);
  const top = z + height;
  if (marked)
    for (const offset of [8, 14])
      creases.push(...worldLine([x + 6, y + offset, top], [x + width - 8, y + offset, top]));
  return surface(silhouette, creases);
}
function transformed(shape: Surface, scale: number, x: number, y: number): Surface {
  const move = ([u, v]: Point): Point => [u * scale + x, v * scale + y];
  return { outline: shape.outline.map(move), marks: shape.marks.map(move) };
}
const roofs = [0, 1, 2].map(i => {
  const x = -60 + i * 39;
  const outline = hull(
    [
      [x, 39],
      [x, 70],
      [x + 36, 45],
      [x + 38, 39],
    ].flatMap(([u, z]) => [project([u, -35, z]), project([u, 40, z])]),
  );
  return surface(outline, [
    ...worldLine([x + 1, 40, 68], [x + 35, 40, 44]),
    ...worldLine([x + 35, 40, 44], [x + 35, -34, 44]),
  ]);
});
const miniScale = 0.46,
  miniX = 314 - 222 * miniScale,
  miniY = 148 - 168 * miniScale;
const accountsMiniX = 80 - 209 * miniScale,
  accountsMiniY = 222 - 213 * miniScale;
const repositoryCenter = project([-21, 107, 13]);
const repoX = 116 - repositoryCenter[0] * 1.65,
  repoY = 181 - repositoryCenter[1] * 1.65;
const repository = transformed(slab(-56, 80, 70, 54, 8, 5, false), 1.65, repoX, repoY);
const brackets = [false, true].map(right => {
  const points: WorldPoint[] = [
    [-40, 102],
    [-27, 89],
    [-22, 94],
    [-31, 103],
    [-22, 112],
    [-27, 117],
  ].map(([x, y]) => {
    const u = (right ? -42 - x : x) + 21,
      v = y - 103;
    return [-21 + (u + v) * Math.SQRT1_2, 107 + (-u + v) * Math.SQRT1_2, 14];
  });
  return transformed(surface(points.map(project), [], 1), 1.65, repoX, repoY);
});
const repoOutlet = project([14, 80, 11]);
const approach = project([-31, 64, 7]),
  threshold = project([-31, 34, 7]);
const codeLink: Point[] = [
  [repoOutlet[0] * 1.65 + repoX, repoOutlet[1] * 1.65 + repoY],
  [260, 175],
  [approach[0] * miniScale + miniX, approach[1] * miniScale + miniY],
  [threshold[0] * miniScale + miniX, threshold[1] * miniScale + miniY],
];
const hiddenLink: Point[] = [
  [200, 175],
  [200, 175],
  [200, 175],
  [200, 175],
];

export function drawingPose(scene: DrawingScene, mode: AccountsMode): DrawingPose {
  const base: DrawingPose = {
    surfaces: [],
    links: [hiddenLink, hiddenLink, hiddenLink],
    building: 0,
    scale: miniScale,
    x: miniX,
    y: miniY,
    foundation: 1,
  };
  if (scene === 'factory')
    return {
      ...base,
      building: 1,
      scale: 1,
      x: 0,
      y: 0,
      foundation: 0,
      surfaces: withFoldedSurfaces([...roofs, conveyorTicket(0, smooth(0.18)), conveyorTicket(1, smooth(0.53))]),
    };
  if (scene === 'codebase')
    return {
      ...base,
      building: 1,
      links: [codeLink, hiddenLink, hiddenLink],
      surfaces: withFoldedSurfaces([
        ...roofs.map(shape => transformed(shape, miniScale, miniX, miniY)),
        repository,
        ...brackets,
      ]),
    };
  if (scene === 'intake')
    return {
      ...base,
      links: [
        [
          [104, 112],
          [104, 142],
          [80, 150],
          [80, 186],
        ],
        hiddenLink,
        hiddenLink,
      ],
      surfaces: withFoldedSurfaces([panel(28, 48, 148, 64), panel(28, 186, 104, 48), panel(148, 186, 104, 48)]),
    };
  const links = [80, 200, 320].map((x, index): Point[] => {
    const origin = mode === 'shared' ? 200 : x;
    return [
      [origin, 90],
      [origin, 126],
      [x, 126],
      [x, index === 0 ? 185 : 156],
    ];
  });
  return {
    ...base,
    links,
    building: 1,
    x: accountsMiniX,
    y: accountsMiniY,
    surfaces: [
      ...roofs.map(shape => transformed(shape, miniScale, accountsMiniX, accountsMiniY)),
      panel(148, 156, 104, 94),
      panel(268, 156, 104, 94),
      panel(mode === 'shared' ? 148 : 28, 48, 104, 42),
      mode === 'shared' ? folded : panel(148, 48, 104, 42),
      mode === 'shared' ? folded : panel(268, 48, 104, 42),
    ],
  };
}

const jambStrokeClearance = 0.5;
const outsideBay = (x: readonly [number, number], y: readonly [number, number]) =>
  polygon(hull(x.flatMap(u => y.flatMap(v => [project([u, v, -1]), project([u, v, 14])]))));

/** A closed fill with an open outline: the edge against the loading bay is hidden. */
function conveyorOutline(belt: ReturnType<typeof box>) {
  const corners = belt.silhouette.map((point, index, points) => {
    const flush = belt.flushCorners.has(point.join());
    const inset = (neighbor: Point) =>
      pointBetween(
        point,
        neighbor,
        flush ? 0 : Math.min(0.45, 3 / Math.hypot(neighbor[0] - point[0], neighbor[1] - point[1])),
      );
    const before = inset(points[(index + points.length - 1) % points.length]);
    const after = inset(points[(index + 1) % points.length]);
    return { before, after, flush, turn: flush ? '' : `Q${point.join(',')} ${after.join(',')}` };
  });
  const start = `M${corners[corners.length - 1].after.join(',')}`;
  const fill = start + corners.map(corner => `L${corner.before.join(',')}${corner.turn}`).join('') + 'Z';
  const outline =
    start +
    corners
      .map((corner, index) => {
        const previous = corners[(index + corners.length - 1) % corners.length];
        const command = previous.flush && corner.flush ? 'M' : 'L';
        return `${command}${corner.before.join(',')}${corner.turn}`;
      })
      .join('');
  const [a, b, c, d] = belt.creases;
  const crease = `M${a.join(',')}L${b.join(',')}Q${belt.creaseCorner.join(',')} ${d.join(',')}L${c.join(',')}`;
  return { fill, outline: outline + crease };
}

const inputBelt = conveyorOutline(box(-52, 40, 42, 102, 0, 7, ([, v]) => v === 40)),
  outputBelt = conveyorOutline(box(57, -10, 88, 38, 0, 7, ([u]) => u === 57));

// Belts stop at the wall, so they always sit in front of it; tickets cross it and keep only what the shell leaves visible.
export const factoryPaths = {
  ticketsVisible: [
    outsideBay([-52, -10 - jambStrokeClearance], [40, 160]),
    outsideBay([57, 160], [-10, 28 - jambStrokeClearance]),
    worldPolygon([
      [-52, 40, 0],
      [-52, 40, 28],
      [-10 - jambStrokeClearance, 40, 28],
      [-10 - jambStrokeClearance, 40, 0],
    ]),
    worldPolygon([
      [57, -10, 0],
      [57, -10, 28],
      [57, 28 - jambStrokeClearance, 28],
      [57, 28 - jambStrokeClearance, 0],
    ]),
  ],
  foundation: contour(slab(-66, -41, 130, 86, -5, 5, false).outline),
  belts: inputBelt.fill + outputBelt.fill,
  beltEdges: inputBelt.outline + outputBelt.outline,
  chimney: contour(slab(30, -34, 16, 16, 0, 93, false).outline),
  chimneyCap: contour(slab(28, -36, 20, 20, 89, 7, false).outline),
  recess:
    worldPolygon([
      [-52, 40, 7],
      [-52, 40, 28],
      [-10, 40, 28],
      [-10, 40, 7],
    ]) +
    worldPolygon([
      [57, -10, 7],
      [57, -10, 28],
      [57, 28, 28],
      [57, 28, 7],
    ]),
  jambs: segments([
    ...worldLine([-52, 40, 28], [-52, 36, 28]),
    ...worldLine([-52, 36, 28], [-52, 36, 7]),
    ...worldLine([-52, 36, 7], [-52, 40, 7]),
    ...worldLine([57, -10, 28], [53, -10, 28]),
    ...worldLine([53, -10, 28], [53, -10, 7]),
    ...worldLine([53, -10, 7], [57, -10, 7]),
  ]),
  wall: worldPolygon([
    [-60, -35, 39],
    [57, -35, 39],
    [57, -35, 0],
    [57, -10, 0],
    [57, -10, 28],
    [57, 28, 28],
    [57, 28, 0],
    [57, 40, 0],
    [-10, 40, 0],
    [-10, 40, 28],
    [-52, 40, 28],
    [-52, 40, 0],
    [-60, 40, 0],
    [-60, 40, 39],
  ]),
  wallMarks: segments([...worldLine([3, 40, 15], [32, 40, 15]), ...worldLine([3, 40, 23], [32, 40, 23])]),
};

export function conveyorTicket(index: number, phase: number): Surface {
  return index === 0 ? slab(-48, 112 - 116 * phase, 34, 28, 7, 3) : slab(19 + 92 * phase, -8, 28, 34, 7, 6);
}
