import { delegating, workflow, connecting, planning, messaging, branching } from './poses/coordination';
import { writing } from './poses/documents';
import { finding, creating, listing, inspecting } from './poses/files';
import { fetching, clicking, typing, screenshot, asking, inbox, scheduling } from './poses/interface';
import { knowledge } from './poses/knowledge';
import { noting, pinning, unpinning, moving, merging } from './poses/knowledge-actions';
import { skill, skillSearching, skillReading } from './poses/skills';
import { running, stopping, output } from './poses/terminal';
import { thinking } from './poses/thinking';
import {
  allOf,
  anyOf,
  dot,
  inCap,
  inCirc,
  inRoundRect,
  inShape,
  kit,
  lerpFrame,
  loopPulse,
  nothing,
  once,
  placed,
  polyline,
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
  'writing',
  'creating',
  'knowledge',
  'listing',
  'inspecting',
  'stopping',
  'output',
  'fetching',
  'clicking',
  'typing',
  'screenshot',
  'asking',
  'inbox',
  'scheduling',
  'noting',
  'pinning',
  'unpinning',
  'moving',
  'merging',
  'delegating',
  'workflow',
  'connecting',
  'planning',
  'messaging',
  'branching',
  'running',
  'deleting',
  'skill',
  'skill-searching',
  'skill-reading',
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

const searching: Pose = t => {
  const w = (TAU * t) / 2.4;
  const at: Point = [0.9 * Math.sin(w), 0.5 * Math.sin(2 * w)];
  const lens = shifted(LENS, at);
  return withTrail(
    kit(nothing, lens, { rings: [[...lens, 4.05, 1.9]] }),
    polyline([shifted([1.8, 1.8], at), shifted([5.4, 5.4], at)], 3.1, 0),
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

const LAYER_TIERS = [-3.2, 0, 3.2];
const diamond = (cy: number): [Point, Point, Point, Point] => [
  [0, cy - 3.6],
  [7.4, cy],
  [0, cy + 3.6],
  [-7.4, cy],
];

const contextFrames = once(() => {
  const layers = (spacing: number) =>
    withTrail(
      kit(anyOf(...LAYER_TIERS.map(cy => inShape(diamond(cy * spacing)))), [0, 0]),
      LAYER_TIERS.slice(0, -1).flatMap(cy => {
        const [, right, bottom, left] = diamond(cy * spacing);
        return polyline([left, bottom, right], 0, 1);
      }),
    );
  return { closed: layers(1), open: layers(1.16) };
});

const context: Pose = clock => {
  const { closed, open } = contextFrames();
  return lerpFrame(closed, open, loopPulse(clock, 3.6));
};

const noticeFrames = once(() => {
  const information = (dotSize: number) =>
    withTrail(
      kit(inCirc(0, 0, 7.4), [0, 0], { cuts: [segment([0, -0.4], [0, 3.8], 1.9)] }),
      dotCut([0, -3.6], dotSize),
    );
  return { rest: information(2.3), emphasis: information(3.1) };
});

const notice: Pose = clock => {
  const { rest, emphasis } = noticeFrames();
  return lerpFrame(rest, emphasis, loopPulse(clock, 2.8));
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

const OUTCOME_STROKE_WIDTH = 2.1;

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
  return twoStrokes(line(at(a), at(b)), line(at(b), at(c)), OUTCOME_STROKE_WIDTH);
};

const CROSS = 4.6;

const error: Pose = (_, s) => {
  const q = settle(s);
  const shake = 1.4 * Math.exp(-q * 5) * Math.sin(q * 36);
  return twoStrokes(
    line([-CROSS + shake, -CROSS], [CROSS + shake, CROSS]),
    line([CROSS + shake, -CROSS], [-CROSS + shake, CROSS]),
    OUTCOME_STROKE_WIDTH,
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
  reading: grown(reading),
  searching: grown(searching),
  finding: grown(finding),
  browsing: grown(browsing),
  editing: grown(editing),
  writing: grown(writing),
  creating: grown(creating),
  knowledge: grown(knowledge),
  listing: grown(listing),
  inspecting: grown(inspecting),
  stopping: grown(stopping),
  output: grown(output),
  fetching: grown(fetching),
  clicking: grown(clicking),
  typing: grown(typing),
  screenshot: grown(screenshot),
  asking: grown(asking),
  inbox: grown(inbox),
  scheduling: grown(scheduling),
  noting: grown(noting),
  pinning: grown(pinning),
  unpinning: grown(unpinning),
  moving: grown(moving),
  merging: grown(merging),
  delegating: grown(delegating),
  workflow: grown(workflow),
  connecting: grown(connecting),
  planning: grown(planning),
  messaging: grown(messaging),
  branching: grown(branching),
  running: grown(running),
  deleting: grown(deleting),
  skill: grown(skill),
  'skill-searching': grown(skillSearching),
  'skill-reading': grown(skillReading),
  tool: grown(tool),
  waiting: grown(waiting),
  done: grown(done),
  error: grown(error),
  context: grown(context),
  notice: grown(notice),
};
