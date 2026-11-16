import type { Pose } from '../poses';
import { inRoundRect, kit, lerpFrame, once, sstep, withTrail } from '../shapes';

const SCREEN = inRoundRect(0, 0, 7.6, 6.2, 2);

const runningFrames = once(() => {
  const screen = (cursor: number) =>
    withTrail(kit(SCREEN, [0, 0], { cuts: [[0.6, 2.8, 4.2, 2.8, cursor]] }), [
      [-4, -2.4, 0, 1.8],
      [-1.2, 0.2, 0, 1.8],
      [-4, 2.8, 0, 0],
    ]);
  return { hidden: screen(0), visible: screen(1.8) };
});

export const running: Pose = t => {
  const p = (t / 1.1) % 1;
  const cursor = 1 - sstep(0.45, 0.55, p) + sstep(0.9, 1, p);
  const { hidden, visible } = runningFrames();
  return lerpFrame(hidden, visible, cursor);
};

const stoppingFrames = once(() => {
  const screen = (half: number) => withTrail(kit(SCREEN, [0, 0], { hole: inRoundRect(0, 0, half, half, 1) }));
  return { expanded: screen(2.8), contracted: screen(2.3) };
});

export const stopping: Pose = t => {
  const p = (t / 1.4) % 1;
  const press = sstep(0, 0.12, p) * (1 - sstep(0.24, 0.6, p));
  const { expanded, contracted } = stoppingFrames();
  return lerpFrame(expanded, contracted, press);
};

const outputFrames = once(() => {
  const screen = (end: number) =>
    withTrail(
      kit(SCREEN, [0, 0], {
        cuts: [
          [-4.1, -1.8, 4.1, -1.8, 1.8],
          [-4.1, 1.8, end, 1.8, 1.8],
        ],
      }),
    );
  return { short: screen(0.6), long: screen(3.2) };
});

export const output: Pose = t => {
  const phase = (t / 2.8 + 0.6) % 1;
  const reveal = sstep(0.08, 0.38, phase) * (1 - sstep(0.82, 1, phase));
  const { short, long } = outputFrames();
  return lerpFrame(short, long, reveal);
};
