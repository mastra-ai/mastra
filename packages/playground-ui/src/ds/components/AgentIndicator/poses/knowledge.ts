import type { Pose } from '../poses';
import { dot, inCirc, kit, lerpFrame, once, sstep, withTrail } from '../shapes';
import type { Point } from '../shapes';

const networkFrames = once(() => {
  const origin: Point = [-0.2, -4.6];
  const added: Point = [6.5, -4.7];
  const network = (node: Point, radius: number, linkEnd: Point) =>
    withTrail(
      kit(inCirc(-4.4, 3.2, 2.7), [-4.4, 3.2], {
        balls: [
          [...origin, 2.3],
          [5, 3.2, 2.5],
        ],
        inks: [
          [-4.4, 3.2, ...origin, 1.7],
          [-4.4, 3.2, 5, 3.2, 1.7],
        ],
      }),
      [[...origin, 1.7, 0], [5, 3.2, 0, 0], [...origin, 1.5, 0], [...linkEnd, 0, 0], ...dot(node, radius * 2)],
    );

  return {
    rest: network(origin, 0, origin),
    added: network(added, 1.8, origin),
    linked: network(added, 1.8, added),
  };
});

export const knowledge: Pose = (clock, sinceEntered) => {
  const phase = Math.min(clock, sinceEntered) % 4;
  const node = sstep(0.65, 1.1, phase) * (1 - sstep(3.05, 3.5, phase));
  const link = sstep(1.1, 1.65, phase) * (1 - sstep(2.6, 3, phase));
  const { rest, added, linked } = networkFrames();
  if (node === 0) return rest;
  return lerpFrame(lerpFrame(rest, added, node), linked, link);
};
