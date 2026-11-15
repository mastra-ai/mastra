import type { Pose } from '../poses';
import { anyOf, inRoundRect, inShape, kit, lerpFrame, loopPulse, once, TAU, withTrail } from '../shapes';
import type { Point } from '../shapes';

const page = (side: 1 | -1, lift: number) =>
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

const openBook = (lift: number) => anyOf(page(1, lift), page(-1, -lift));

const invocationFrames = once(() => {
  const book = (lift: number) => withTrail(kit(openBook(lift), [0, 0.4], { cuts: [[0, -6, 0, 7.2, 1.1]] }));
  return { rest: book(0), left: book(-0.5), right: book(0.5) };
});

export const skill: Pose = t => {
  const lift = Math.sin((TAU * t) / 2.2);
  const { rest, left, right } = invocationFrames();
  return lerpFrame(rest, lift < 0 ? left : right, Math.abs(lift));
};

const searchFrames = once(() => {
  const book = (x: number) =>
    withTrail(
      kit(openBook(0), [0, 0.4], {
        cuts: [[0, -6, 0, 7.2, 1.1]],
        rings: [[x, 3.2, 2.7, 1.65]],
      }),
      [
        [x, 3.2, 0, 8.45],
        [x, 3.2, 0, 0],
        [x + 2.35, 5.55, 1.8, 0],
        [x + 4, 7.2, 0, 0],
      ],
    );
  return { right: book(4.5), left: book(1.5) };
});

export const skillSearching: Pose = t => {
  const { right, left } = searchFrames();
  return lerpFrame(right, left, loopPulse(t, 3.6));
};

const readingFrames = once(() => {
  const book = (upper: number, lower: number) =>
    withTrail(
      kit(inRoundRect(0, 0, 6.3, 7.3, 1.8), [0, 0], {
        cuts: [
          [-3.2, -8, -3.2, 8, 1.05],
          [-0.7, -1.8, 3.6, -1.8, upper],
        ],
      }),
      [
        [-0.7, 1.6, 0, lower],
        [2.4, 1.6, 0, 0],
      ],
    );
  return { rest: book(1.55, 1.55), reading: book(2.1, 1.25) };
});

export const skillReading: Pose = t => {
  const { rest, reading } = readingFrames();
  return lerpFrame(rest, reading, loopPulse(t, 3.2));
};
