import {
  allOf,
  anyOf,
  around,
  dot,
  inCap,
  inCirc,
  inOval,
  inRoundRect,
  inShape,
  kit,
  lerpFrame,
  nothing,
  once,
  placed,
  range,
  sstep,
  TAU,
  withTrail,
} from './shapes';
import type { Frame, Inside, Point, Segment, TrailPoint } from './shapes';

export const agentIndicatorStates = [
  'idle',
  'memory',
  'thinking',
  'reading',
  'searching',
  'finding',
  'browsing',
  'editing',
  'running',
  'deleting',
  'skill',
  'tool',
  'waiting',
  'done',
  'error',
  'context',
  'notice',
] as const;

export type AgentIndicatorState = (typeof agentIndicatorStates)[number];

export type Pose = (clock: number, sinceEntered: number) => Frame;

export const MORPH_SECONDS = 0.52;

const GROW = 1.2;
const settle = (sinceEntered: number) => Math.max(0, sinceEntered - MORPH_SECONDS);

const AGENT_HEAD: Point = [0, -5.5];
const AGENT_LIMBS: [Point, Point, Point, Point] = [
  [-5.778, -1.293],
  [5.778, -1.293],
  [3.57, 5.5],
  [-3.57, 5.5],
];
const AGENT_WEB: Point[] = [AGENT_LIMBS[0], [-4.029, -2.566], [4.029, -2.566], ...AGENT_LIMBS.slice(1)];
const AGENT_NOTCHES: Point[] = [
  [-4.674, 2.104],
  [4.674, 2.104],
  [0, 5.5],
];
const AGENT_DOT = 4.326;

const agent = once(() =>
  withTrail(kit(inShape(AGENT_WEB), [0, 1.8]), [
    ...dot(AGENT_HEAD, AGENT_DOT),
    [...AGENT_HEAD, 0, 9.968],
    [...AGENT_HEAD, 0, 0],
    ...AGENT_LIMBS.flatMap(limb => dot(limb, AGENT_DOT)),
    ...AGENT_NOTCHES.flatMap((notch): TrailPoint[] => [
      [...notch, 0, 2.818],
      [...notch, 0, 0],
    ]),
  ]),
);

const memory: Pose = t => {
  const c = t / 2.4;
  const turn = Math.floor(c) + sstep(0, 0.6, c - Math.floor(c));
  const minute = -Math.PI / 2 - TAU * turn;
  const hour = -2.6 - (TAU / 12) * turn;
  return withTrail(
    kit(inCirc(0, 0, 7.8), [0, 0], {
      cuts: [
        [0, 0, 4.6 * Math.cos(minute), 4.6 * Math.sin(minute), 2.2],
        [0, 0, 3 * Math.cos(hour), 3 * Math.sin(hour), 2.2],
      ],
    }),
  );
};

const sulcus =
  ([a, b, amp, waves]: [Point, Point, number, number]) =>
  (u: number): Point => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    const s = amp * Math.sin(Math.PI * waves * u);
    return [a[0] + dx * u - (dy / length) * s, a[1] + dy * u + (dx / length) * s];
  };

const PROFILE = anyOf(
  inOval(-0.3, -1.3, 7.9, 5.3, 0.035),
  inOval(-1.6, 2.2, 4.6, 2.6),
  inOval(5, 3.4, 2.8, 2),
  inCap([1.4, 2.6], [2.1, 6.8], 1.2),
);
const SULCI = (
  [
    [[-5.8, 1.4], [3, -1.6], 0.5, 2],
    [[0.9, -7], [-0.6, -2.6], 0.45, 3],
    [[-7.6, -2.2], [-3.4, -3.4], 0.55, 2],
    [[4.6, -6], [5.6, -1.6], 0.5, 2],
    [[2.4, 2.4], [8.2, 1.8], 0, 1],
  ] satisfies [Point, Point, number, number][]
).map(sulcus);

const brainKit = once(() => kit(PROFILE, [0.4, 0.4], { cuts: [[2.9, 3, 3.4, 6.2, 1.2]] }));

const brain = (t: number) =>
  withTrail(
    brainKit(),
    SULCI.flatMap((fold, j) =>
      range(9).map((i): TrailPoint => {
        const pulse = 0.7 * Math.max(0, Math.cos(2.2 * t - 1.3 * j - (3 * i) / 8)) ** 6;
        return [...fold(i / 8), 0, i < 8 ? (j ? 1.6 : 1.9) + pulse : 0];
      }),
    ),
  );

const BULB = anyOf(
  inCirc(0, -1.2, 4.6),
  inShape([
    [-3.1, 1.9],
    [3.1, 1.9],
    [2.1, 4.4],
    [-2.1, 4.4],
  ]),
  inRoundRect(0, 5.5, 2.1, 1.4, 0.8),
);
const BULB_RAYS = [-132, -48, -174, -6, -90].map(d => (d * Math.PI) / 180);

const bulbKit = once(() =>
  kit(BULB, [0, 0], {
    cuts: [
      [0, -2, 0, -2, 0],
      [-2.6, 5.4, 2.6, 5.4, 0.8],
    ],
  }),
);

const bulb = (light: number) =>
  withTrail(
    bulbKit(),
    BULB_RAYS.flatMap((a, j) => {
      const n = j < 4 ? 15 : 2;
      return range(n).map(
        (i): TrailPoint => [...around([0, -1.2], a, 5.9 + (1.5 * light * i) / (n - 1)), i < n - 1 ? 1.8 * light : 0, 0],
      );
    }),
  );

const thinking: Pose = t => {
  const p = (t / 5) % 1;
  const lit = sstep(0.28, 0.4, p) * (1 - sstep(0.76, 0.88, p));
  const glow = sstep(0.4, 0.5, p) * (1 - sstep(0.68, 0.76, p));
  return lerpFrame(brain(t), bulb(glow * (1 + 0.06 * Math.sin(8 * t))), lit);
};

const TELESCOPE = anyOf(
  inShape([
    [-6.8, -1.3],
    [5.4, -2.6],
    [5.4, 2.6],
    [-6.8, 1.3],
  ]),
  inCap([-6.8, 0], [-8, 0], 1.6),
  inCirc(0, 1.6, 1.8),
);
const MOUNT: Point = [-0.4, 1];

const browsing: Pose = t => {
  const a = -0.5 + 0.2 * Math.sin(0.9 * t) + 0.06 * Math.sin(2.3 * t);
  return withTrail(
    kit(placed(TELESCOPE, a, MOUNT), MOUNT, {
      inks: [
        [MOUNT[0], MOUNT[1] + 1.4, -4.2, 8, 1.8],
        [MOUNT[0], MOUNT[1] + 1.4, 3.4, 8, 1.8],
      ],
    }),
  );
};

const NUT: Inside = ([x, y]) => {
  const side = Math.PI / 3;
  const a = ((Math.atan2(y, x) % side) + side) % side;
  return Math.hypot(x, y) < (7.4 * Math.cos(side / 2)) / Math.cos(a - side / 2);
};

const nut = (turn: number) => withTrail(kit(placed(NUT, (Math.PI / 3) * turn), [0, 0], { hole: inCirc(0, 0, 2.8) }));
const restingNut = once(() => nut(0));

const tool: Pose = t => {
  const c = t / 1.1;
  const turn = sstep(0.55, 0.85, c - Math.floor(c));
  return Number.isInteger(turn) ? restingNut() : nut(turn);
};

const turned = ([x, y]: Point, a: number): Point => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const shifted = ([x, y]: Point, [dx, dy]: Point): Point => [x + dx, y + dy];
const segment = (a: Point, b: Point, width: number): Segment => [...a, ...b, width];
const polyline = (points: Point[], ink: number, cut: number): TrailPoint[] =>
  points.map((p, i) => (i < points.length - 1 ? [...p, ink, cut] : [...p, 0, 0]));
const dotCut = (p: Point, d: number): TrailPoint[] => [
  [...p, 0, d],
  [...p, 0, 0],
];

const ALMOND = allOf(inCirc(0, 4.6, 8.8), inCirc(0, -4.6, 8.8));

const reading: Pose = t => {
  const iris: Point = [1.5 * Math.sin((TAU * t) / 2.6), 0];
  return withTrail(kit(ALMOND, [0, 0], { hole: inCirc(...iris, 3.1), holeCenter: iris, balls: [[...iris, 1.7]] }));
};

const LENS: Point = [-1.6, -1.6];
const MAGNIFIER = anyOf(inCirc(...LENS, 5), inCap([1.8, 1.8], [5.4, 5.4], 1.7));

const searching: Pose = t => {
  const w = (TAU * t) / 2.4;
  const at: Point = [0.9 * Math.sin(w), 0.5 * Math.sin(2 * w)];
  const lens = shifted(LENS, at);
  return withTrail(kit(placed(MAGNIFIER, 0, at), lens, { hole: inCirc(...lens, 3.1), holeCenter: lens }));
};

const FOLDER = anyOf(inRoundRect(0, 0.8, 7.6, 5, 1.8), inRoundRect(-4, -4.4, 3.6, 1.4, 1.2));
const FOLDER_LENS: Point = [-0.6, 0.6];

const finding: Pose = t => {
  const w = (TAU * t) / 2.8;
  const lens = shifted(FOLDER_LENS, [1.3 * Math.sin(w), 0.6 * Math.sin(2 * w)]);
  return withTrail(
    kit(FOLDER, [0, 0.4], {
      hole: inCirc(...lens, 2.9),
      holeCenter: lens,
      balls: [[...lens, 1.7]],
      cuts: [segment(shifted(lens, [2.1, 2.1]), shifted(lens, [3.5, 3.5]), 1.5)],
    }),
  );
};

const PEN = anyOf(
  inCap([-2.6, 2.6], [5, -5], 2.3),
  inShape([
    [-4.23, 0.97],
    [-0.97, 4.23],
    [-5.9, 5.9],
  ]),
);
const PEN_BANDS: [Point, Point][] = [
  [
    [-3.4, 0.6],
    [-0.6, 3.4],
  ],
  [
    [1.4, -4.2],
    [4.2, -1.4],
  ],
];

const editing: Pose = t => {
  const w = (TAU * t) / 0.9;
  const at: Point = [0.45 * Math.sin(w), 0.3 * Math.sin(2 * w)];
  return withTrail(
    kit(placed(PEN, 0, at), at, {
      cuts: PEN_BANDS.map(([a, b]) => segment(shifted(a, at), shifted(b, at), 1)),
    }),
  );
};

const SCREEN = inRoundRect(0, 0, 7.6, 6.2, 2);
const PROMPT: Point[] = [
  [-4, -2.4],
  [-1.2, 0.2],
  [-4, 2.8],
];

const running: Pose = t => {
  const p = (t / 1.1) % 1;
  const cursor = 1 - sstep(0.45, 0.55, p) + sstep(0.9, 1, p);
  return withTrail(
    kit(SCREEN, [0, 0], { cuts: [segment([0.6, 2.8], [4.2, 2.8], 1.8 * cursor)] }),
    polyline(PROMPT, 0, 1.8),
  );
};

const CAN = anyOf(inRoundRect(0, 1.6, 5.4, 5.2, 1.4), inRoundRect(0, -4.4, 7.2, 1, 1), inRoundRect(0, -6, 2.4, 1, 0.8));
const CAN_CUTS: [Point, Point][] = [
  [
    [-1.9, -0.8],
    [-1.9, 4.4],
  ],
  [
    [1.9, -0.8],
    [1.9, 4.4],
  ],
];
const LID_SEAM: Point[] = [
  [-5.6, -3.2],
  [5.6, -3.2],
];

const deleting: Pose = t => {
  const a = 0.08 * Math.sin((TAU * t) / 1.2);
  return withTrail(
    kit(placed(CAN, a), [0, 0], { cuts: CAN_CUTS.map(([p, q]) => segment(turned(p, a), turned(q, a), 1.3)) }),
    polyline(
      LID_SEAM.map(p => turned(p, a)),
      0,
      0.9,
    ),
  );
};

const page = (side: 1 | -1, lift: number): Inside =>
  inShape(
    (
      [
        [-0.1, -3.6],
        [3, -5.2 - lift],
        [7.6, -5 - lift],
        [7.6, 4.6],
        [3, 4.8],
        [-0.1, 6.2],
      ] satisfies Point[]
    ).map(([x, y]): Point => [side * x, y]),
  );

const skill: Pose = t => {
  const lift = 0.5 * Math.sin((TAU * t) / 2.2);
  return withTrail(kit(anyOf(page(1, lift), page(-1, -lift)), [0, 0.4], { cuts: [segment([0, -3.2], [0, 5.6], 1)] }));
};

const LAYER_TIERS = [-3.2, 0, 3.2];
const diamond = (cy: number): [Point, Point, Point, Point] => [
  [0, cy - 3.6],
  [7.4, cy],
  [0, cy + 3.6],
  [-7.4, cy],
];

const context = once(() =>
  withTrail(
    kit(anyOf(...LAYER_TIERS.map(cy => inShape(diamond(cy)))), [0, 0]),
    LAYER_TIERS.slice(0, -1).flatMap(cy => {
      const [, right, bottom, left] = diamond(cy);
      return polyline([left, bottom, right], 0, 1);
    }),
  ),
);

const notice = once(() =>
  withTrail(kit(inCirc(0, 0, 7.4), [0, 0], { cuts: [segment([0, -0.4], [0, 3.8], 1.9)] }), dotCut([0, -3.6], 2.3)),
);

const blank = once(() => kit(nothing, [0, 0]));
const line =
  (a: Point, b: Point) =>
  (u: number): Point => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

const twoStrokes = (first: (u: number) => Point, second: (u: number) => Point, width: number) =>
  withTrail(
    blank(),
    [first, second].flatMap(stroke => range(32).map((i): TrailPoint => [...stroke(i / 31), i < 31 ? width : 0, 0])),
  );

const waiting = once(() => twoStrokes(line([-2.7, -3.4], [-2.7, 3.4]), line([2.7, -3.4], [2.7, 3.4]), 2.2));

const CHECK: [Point, Point, Point] = [
  [-6.2, 0.4],
  [-2.2, 4.4],
  [6.4, -4.8],
];

const done: Pose = (_, s) => {
  const q = settle(s);
  const k = 1 + 0.08 * Math.exp(-q * 7) * Math.sin(q * 15);
  const at = ([x, y]: Point): Point => [x * k, y * k];
  const [a, b, c] = CHECK;
  return twoStrokes(line(at(a), at(b)), line(at(b), at(c)), 2.1);
};

const CROSS = 4.6;

const error: Pose = (_, s) => {
  const q = settle(s);
  const shake = 1.4 * Math.exp(-q * 5) * Math.sin(q * 36);
  return twoStrokes(
    line([-CROSS + shake, -CROSS], [CROSS + shake, CROSS]),
    line([CROSS + shake, -CROSS], [-CROSS + shake, CROSS]),
    2.1,
  );
};

const grown =
  (pose: Pose): Pose =>
  (t, s) =>
    pose(t, s).map(v => v * GROW);

const RINGING_SECONDS = MORPH_SECONDS + 2;

export const restsAfterSeconds: Partial<Record<AgentIndicatorState, number>> = {
  idle: 0,
  waiting: 0,
  context: 0,
  notice: 0,
  done: RINGING_SECONDS,
  error: RINGING_SECONDS,
};

export const poses: Record<AgentIndicatorState, Pose> = {
  idle: grown(agent),
  memory: grown(memory),
  thinking: grown(thinking),
  reading: grown(reading),
  searching: grown(searching),
  finding: grown(finding),
  browsing: grown(browsing),
  editing: grown(editing),
  running: grown(running),
  deleting: grown(deleting),
  skill: grown(skill),
  tool: grown(tool),
  waiting: grown(waiting),
  done: grown(done),
  error: grown(error),
  context: grown(context),
  notice: grown(notice),
};
