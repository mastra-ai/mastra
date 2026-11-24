import type { Pose } from '../poses';
import { inRoundRect, kit, lerpFrame, once, sstep, withTrail } from '../shapes';

const writingFrames = once(() => {
  const page = (end: number) =>
    withTrail(
      kit(inRoundRect(0, 0, 6, 7.5, 2), [0, 0], {
        cuts: [
          [-2.8, -1.8, 2.8, -1.8, 1.8],
          [-2.8, 2, end, 2, 1.8],
        ],
      }),
    );
  return { start: page(-1), end: page(2.8) };
});

export const writing: Pose = t => {
  const phase = (t / 2.6 + 0.55) % 1;
  const written = sstep(0.08, 0.5, phase) * (1 - sstep(0.82, 1, phase));
  const { start, end } = writingFrames();
  return lerpFrame(start, end, written);
};
