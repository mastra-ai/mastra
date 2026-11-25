import type { Pose } from '../poses';
import { anyOf, inCirc, inRoundRect, inShape, kit, lerpFrame, once, range, sstep, withTrail } from '../shapes';
import type { Point, TrailPoint } from '../shapes';

const pulse = (phase: number, start: number, end: number) =>
  sstep(start, start + 0.07, phase) * (1 - sstep(end, end + 0.12, phase));

const fetchingFrames = once(() => {
  const browser = (firstWidth: number, secondWidth: number) =>
    withTrail(
      kit(inRoundRect(0, 0, 7.6, 7.2, 2), [0, 0], {
        cuts: [
          [-5.8, -3.2, 5.8, -3.2, 1.4],
          [-4.3, 0, 4.3, 0, firstWidth],
        ],
      }),
      [
        [-4.3, 3.2, 0, secondWidth],
        [1.7, 3.2, 0, 0],
        [-4.3, -5.1, 0, 1.1],
        [-4.3, -5.1, 0, 0],
        [-1.9, -5.1, 0, 1.1],
        [-1.9, -5.1, 0, 0],
      ],
    );
  return { rest: browser(1.7, 1.7), first: browser(2.4, 1.3), second: browser(1.3, 2.4) };
});

export const fetching: Pose = t => {
  const phase = (t / 3.2) % 1;
  const { rest, first, second } = fetchingFrames();
  return lerpFrame(lerpFrame(rest, first, pulse(phase, 0.08, 0.35)), second, pulse(phase, 0.5, 0.8));
};

const clickingFrames = once(() => {
  const rest = withTrail(
    kit(
      inShape([
        [-5.6, -7.2],
        [-5.6, 5.4],
        [5.6, 0.2],
      ]),
      [-2, 0],
      { inks: [[-2, 0, 2.1, 7.1, 3.3]] },
    ),
  );
  return { rest, pressed: rest.map(value => value * 0.88) };
});

export const clicking: Pose = t => {
  const { rest, pressed } = clickingFrames();
  return lerpFrame(rest, pressed, pulse((t / 2.6) % 1, 0.2, 0.32));
};

const typingFrames = once(() => {
  const keyboard = (active: number) =>
    withTrail(
      kit(inRoundRect(0, 0, 8, 5.6, 1.8), [0, 0], { cuts: [[-3.4, 3.4, 3.4, 3.4, active === 6 ? 2.1 : 1.5]] }),
      [-3.1, 0.1].flatMap((y, row) =>
        [-4.6, 0, 4.6].flatMap((x, column): TrailPoint[] => [
          [x, y, 0, active === row * 3 + column ? 2.4 : 1.6],
          [x, y, 0, 0],
        ]),
      ),
    );
  return { rest: keyboard(-1), left: keyboard(0), right: keyboard(5), space: keyboard(6) };
});

export const typing: Pose = t => {
  const phase = (t / 2) % 1;
  const { rest, left, right, space } = typingFrames();
  const keys = lerpFrame(lerpFrame(rest, left, pulse(phase, 0.06, 0.16)), right, pulse(phase, 0.36, 0.46));
  return lerpFrame(keys, space, pulse(phase, 0.66, 0.78));
};

const screenshotFrames = once(() => {
  const camera = (lens: number, pupil: number) =>
    withTrail(
      kit(anyOf(inRoundRect(0, 1, 8, 5.4, 1.8), inRoundRect(-0.5, -4.2, 3.4, 1.9, 1.1)), [0, 0.6], {
        hole: inCirc(0, 1, lens),
        holeCenter: [0, 1],
        balls: [[0, 1, pupil]],
      }),
    );
  return { open: camera(3.3, 1.7), shuttered: camera(2.8, 1.3) };
});

export const screenshot: Pose = t => {
  const { open, shuttered } = screenshotFrames();
  return lerpFrame(open, shuttered, pulse((t / 3.4) % 1, 0.2, 0.29));
};

const cubicPoint = ([start, first, last, end]: [Point, Point, Point, Point], u: number): Point => {
  const v = 1 - u;
  return [
    v ** 3 * start[0] + 3 * v ** 2 * u * first[0] + 3 * v * u ** 2 * last[0] + u ** 3 * end[0],
    v ** 3 * start[1] + 3 * v ** 2 * u * first[1] + 3 * v * u ** 2 * last[1] + u ** 3 * end[1],
  ];
};

const askingFrames = once(() => {
  const question: [Point, Point, Point, Point][] = [
    [
      [-2.2, -2.9],
      [-2.1, -5.1],
      [2.3, -5.2],
      [2.3, -2.9],
    ],
    [
      [2.3, -2.9],
      [2.3, -1.3],
      [0.1, -1.2],
      [0.1, 0.4],
    ],
  ];
  const bubble = (lift: number, dot: number) =>
    withTrail(
      kit(
        anyOf(
          inRoundRect(0, -1, 7.8, 5.8, 2.5),
          inShape([
            [-5.8, 2],
            [-1.8, 3],
            [-5.8, 7.6],
          ]),
        ),
        [0, -1],
      ),
      [
        ...question.flatMap((curve, index) =>
          range(index === question.length - 1 ? 17 : 16).map((i): TrailPoint => {
            const [x, y] = cubicPoint(curve, i / 16);
            return [x, y - lift, 0, i === 16 ? 0 : 1.8];
          }),
        ),
        [0.1, 3.1, 0, dot],
        [0.1, 3.1, 0, 0],
      ],
    );
  return { rest: bubble(0, 1.8), questioning: bubble(0.45, 2.3) };
});

export const asking: Pose = t => {
  const { rest, questioning } = askingFrames();
  return lerpFrame(rest, questioning, pulse((t / 3.8) % 1, 0.16, 0.48));
};

const inboxFrames = once(() => {
  const tray = (drop: number) =>
    withTrail(
      kit(
        inShape([
          [0, 0.6 + drop],
          [-3.1, -2.4 + drop],
          [3.1, -2.4 + drop],
        ]),
        [0, -1.2 + drop],
        { inks: [[0, -6.6 + drop, 0, -2.2 + drop, 2.2]] },
      ),
      [
        [-7.4, -1.4, 2.8, 0],
        [-7.4, 6.4, 2.8, 0],
        [7.4, 6.4, 2.8, 0],
        [7.4, -1.4, 0, 0],
      ],
    );
  return { waiting: tray(0), receiving: tray(2.5) };
});

export const inbox: Pose = t => {
  const { waiting, receiving } = inboxFrames();
  return lerpFrame(waiting, receiving, pulse((t / 3) % 1, 0.14, 0.52));
};

const schedulingFrames = once(() => {
  const calendar = (active: number) =>
    withTrail(
      kit(inRoundRect(0, 0.8, 7.2, 6.8, 1.8), [0, 0.8], {
        cuts: [[-5.7, -2.2, 5.7, -2.2, 1.5]],
        inks: [
          [-3.4, -7.6, -3.4, -4.8, 2.4],
          [3.4, -7.6, 3.4, -4.8, 2.4],
        ],
      }),
      [0.7, 4].flatMap((y, row) =>
        [-2.5, 2.5].flatMap((x, column): TrailPoint[] => [
          [x, y, 0, active === row * 2 + column ? 3.2 : 2.2],
          [x, y, 0, 0],
        ]),
      ),
    );
  return { rest: calendar(-1), first: calendar(0), next: calendar(3) };
});

export const scheduling: Pose = t => {
  const phase = (t / 3.4) % 1;
  const { rest, first, next } = schedulingFrames();
  return lerpFrame(lerpFrame(rest, first, pulse(phase, 0.1, 0.3)), next, pulse(phase, 0.52, 0.74));
};
