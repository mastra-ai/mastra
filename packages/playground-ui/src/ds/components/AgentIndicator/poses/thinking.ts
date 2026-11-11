import type { Pose } from '../poses';
import {
  anyOf,
  around,
  inCap,
  inCirc,
  inOval,
  inRoundRect,
  inShape,
  kit,
  lerpFrame,
  once,
  range,
  sstep,
  withTrail,
} from '../shapes';
import type { Point, TrailPoint } from '../shapes';

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

export const thinking: Pose = t => {
  const p = (t / 5) % 1;
  const lit = sstep(0.28, 0.4, p) * (1 - sstep(0.76, 0.88, p));
  const glow = sstep(0.4, 0.5, p) * (1 - sstep(0.68, 0.76, p));
  return lerpFrame(brain(t), bulb(glow * (1 + 0.06 * Math.sin(8 * t))), lit);
};
