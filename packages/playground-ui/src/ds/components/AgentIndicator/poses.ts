import {
  anyOf,
  around,
  clamp01,
  dot,
  glide,
  inCap,
  inCirc,
  inOval,
  inRoundRect,
  inShape,
  kit,
  lerpFrame,
  nothing,
  placed,
  range,
  sstep,
  TAU,
  withTrail,
} from './shapes';
import type { Frame, Inside, Point, TrailPoint } from './shapes';

export const agentIndicatorStates = [
  'idle',
  'memory',
  'thinking',
  'searching',
  'tool',
  'writing',
  'waiting',
  'done',
  'error',
] as const;

export type AgentIndicatorState = (typeof agentIndicatorStates)[number];

export type Pose = (clock: number, sinceEntered: number) => Frame;

export const MORPH_SECONDS = 0.52;

const GROW = 1.2;
const settle = (sinceEntered: number) => Math.max(0, sinceEntered - MORPH_SECONDS);

function once<T>(make: () => T) {
  let value: T | undefined;
  return () => (value ??= make());
}

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

const searching: Pose = t => {
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

const HOME: Point = [-7.8, -5.4];
const ROWS: [number, [number, number][]][] = [
  [
    HOME[1],
    [
      [HOME[0], -2.8],
      [0.8, 4.8],
    ],
  ],
  [
    0,
    [
      [HOME[0], -0.2],
      [3.4, 4.8],
    ],
  ],
  [
    5.4,
    [
      [HOME[0], -4.2],
      [-0.6, 1.6],
    ],
  ],
];
const WORDS = ROWS.flatMap(([y, spans]) => spans.map(([from, to]) => ({ from, to, y })));
const STEPS = WORDS.map((word, i) => {
  const next = WORDS[i + 1];
  return { ...word, next, gap: next && next.y !== word.y ? 4.5 : 1.6 };
});
const TYPED = STEPS.reduce((n, { from, to, gap }) => n + to - from + gap, 0);

const writing: Pose = t => {
  const p = (t / 5.2) % 1;
  const fade = 1 - sstep(0.8, 0.9, p);
  let left = glide((p - 0.04) / 0.68, 0.08) * TYPED;
  let head = HOME;
  const strokes = STEPS.flatMap(({ from, to, y, next, gap }): TrailPoint[] => {
    const e = clamp01(left / (to - from));
    const x = from + (to - from) * e;
    if (left > 0) head = [x, y];
    if (next && left > to - from) {
      const k = sstep(0, 1, (left - to + from) / gap);
      head = [to + (next.from - to) * k, y + (next.y - y) * k];
    }
    left -= to - from + gap;
    return [
      [from, y, 2.4 * fade * sstep(0, 0.05, e), 0],
      [x, y, 0, 0],
    ];
  });
  const back = sstep(0.82, 0.96, p);
  const caret: Point = [head[0] + 3.2 + (HOME[0] - head[0]) * back, head[1] + (HOME[1] - head[1]) * back];
  return withTrail(kit(inCap([caret[0], caret[1] - 1.5], [caret[0], caret[1] + 1.5], 1.1), caret), strokes);
};

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
  done: RINGING_SECONDS,
  error: RINGING_SECONDS,
};

export const poses: Record<AgentIndicatorState, Pose> = {
  idle: grown(agent),
  memory: grown(memory),
  thinking: grown(thinking),
  searching: grown(searching),
  tool: grown(tool),
  writing: grown(writing),
  waiting: grown(waiting),
  done: grown(done),
  error: grown(error),
};
