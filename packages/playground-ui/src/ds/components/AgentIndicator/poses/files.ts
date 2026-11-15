import type { Pose } from '../poses';
import { anyOf, inCirc, inRoundRect, kit, lerpFrame, nothing, once, sstep, TAU, withTrail } from '../shapes';
import type { Point } from '../shapes';

const FOLDER = anyOf(inRoundRect(0, 0.8, 7.6, 5, 1.8), inRoundRect(-4, -4.4, 3.6, 1.4, 1.2));

const findingFrames = once(() => {
  const folder = (lens: Point) =>
    withTrail(
      kit(FOLDER, [0, 0.4], {
        hole: inCirc(...lens, 2.9),
        holeCenter: lens,
        balls: [[...lens, 1.7]],
        cuts: [[lens[0] + 2.1, lens[1] + 2.1, lens[0] + 3.2, lens[1] + 3.2, 1.5]],
      }),
    );
  return {
    topLeft: folder([-1.9, 0.35]),
    topRight: folder([0.7, 0.35]),
    bottomLeft: folder([-1.9, 0.85]),
    bottomRight: folder([0.7, 0.85]),
  };
});

export const finding: Pose = t => {
  const w = (TAU * t) / 2.8;
  const horizontal = 0.5 + 0.5 * Math.sin(w);
  const vertical = 0.5 + 0.5 * Math.sin(2 * w);
  const { topLeft, topRight, bottomLeft, bottomRight } = findingFrames();
  const top = lerpFrame(topLeft, topRight, horizontal);
  const bottom = lerpFrame(bottomLeft, bottomRight, horizontal);
  return lerpFrame(top, bottom, vertical);
};

const creatingFrames = once(() => {
  const folder = (arm: number) =>
    withTrail(
      kit(FOLDER, [0, 0.4], {
        cuts: [
          [-arm, 1, arm, 1, 1.7],
          [0, 1 - arm, 0, 1 + arm, 1.7],
        ],
      }),
    );
  return { small: folder(2.6 * 0.85), large: folder(2.6 * 1.15) };
});

export const creating: Pose = t => {
  const { small, large } = creatingFrames();
  return lerpFrame(small, large, 0.5 + 0.5 * Math.sin((TAU * t) / 1.6));
};

const listingFrames = once(() => {
  const folder = (end: number) =>
    withTrail(
      kit(FOLDER, [0, 0.4], {
        cuts: [
          [-0.8, -1.2, 4.2, -1.2, 1.6],
          [-0.8, 2, end, 2, 1.6],
        ],
      }),
      [
        [-3.7, -1.2, 0, 1.8],
        [-3.7, -1.2, 0, 0],
        [-3.7, 2, 0, 1.8],
        [-3.7, 2, 0, 0],
      ],
    );
  return { short: folder(1.5), long: folder(4.2) };
});

export const listing: Pose = t => {
  const phase = (t / 3 + 0.5) % 1;
  const reveal = sstep(0.1, 0.4, phase) * (1 - sstep(0.8, 1, phase));
  const { short, long } = listingFrames();
  return lerpFrame(short, long, reveal);
};

const inspectingFrames = once(() => {
  const brackets = (x: number) =>
    withTrail(kit(nothing, [0, 0], { inks: [[x, -2.8, x, 2.8, 1.8]] }), [
      [-3.2, -4.4, 2.3, 0],
      [-7.3, 0, 2.3, 0],
      [-3.2, 4.4, 0, 0],
      [3.2, -4.4, 2.3, 0],
      [7.3, 0, 2.3, 0],
      [3.2, 4.4, 0, 0],
    ]);
  return { left: brackets(-0.8), right: brackets(0.8) };
});

export const inspecting: Pose = t => {
  const scan = 0.5 + 0.5 * Math.sin((TAU * t) / 2.8);
  const { left, right } = inspectingFrames();
  return lerpFrame(left, right, scan);
};
