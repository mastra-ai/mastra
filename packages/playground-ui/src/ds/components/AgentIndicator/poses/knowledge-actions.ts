import type { Pose } from '../poses';
import { inShape, kit, lerpFrame, loopPulse, nothing, once, placed, polyline, withTrail } from '../shapes';

const noteFrames = once(() => {
  const note = (written: number) =>
    withTrail(
      kit(
        inShape([
          [-6, -7],
          [6, -7],
          [6, 2.5],
          [1.5, 7],
          [-6, 7],
        ]),
        [0, 0],
        {
          cuts: [
            [-3, -2.8, 3, -2.8, 1.8],
            [-3, -0.1, 0.5 + 2.5 * written, -0.1, 1.8],
          ],
        },
      ),
      polyline(
        [
          [1.5, 6.4],
          [1.5, 2.5],
          [5.4, 2.5],
        ],
        0,
        1.5,
      ),
    );
  return { ready: note(0), written: note(1) };
});

export const noting: Pose = t => {
  const { ready, written } = noteFrames();
  return lerpFrame(ready, written, loopPulse(t, 2.8));
};

const pinShape = (pressed: number) =>
  inShape([
    [-3.2, -6 + pressed],
    [3.2, -6 + pressed],
    [2.5, -1 + pressed],
    [4.7, 2 + pressed],
    [0.8, 2 + pressed],
    [0, 7.5],
    [-0.8, 2 + pressed],
    [-4.7, 2 + pressed],
    [-2.5, -1 + pressed],
  ]);

const PIN = pinShape(0);

const pinFrames = once(() => ({
  ready: withTrail(kit(PIN, [0, 0])),
  pressed: withTrail(kit(pinShape(1), [0, 0])),
}));

export const pinning: Pose = t => {
  const { ready, pressed } = pinFrames();
  return lerpFrame(ready, pressed, loopPulse(t, 3.1));
};

const unpinFrames = once(() => {
  const lifted = (lift: number) =>
    withTrail(
      kit(placed(PIN, 0, [0, -lift]), [0, -lift], { cuts: [[-5.4, -5.8, 5.4, 5.8, 2.6]] }),
      polyline(
        [
          [-5.4, -5.8],
          [5.4, 5.8],
        ],
        1.6,
        0,
      ),
    );
  return { ready: lifted(0), lifted: lifted(0.9) };
});

export const unpinning: Pose = t => {
  const { ready, lifted } = unpinFrames();
  return lerpFrame(ready, lifted, loopPulse(t, 3.1));
};

const moveFrames = once(() => {
  const arrow = (advance: number) =>
    withTrail(
      kit(nothing, [advance, 0], { inks: [[-7.2 + advance, 0, 6.8 + advance, 0, 2.5]] }),
      polyline(
        [
          [1 + advance, -5.5],
          [6.8 + advance, 0],
          [1 + advance, 5.5],
        ],
        2.5,
        0,
      ),
    );
  return { ready: arrow(0), advanced: arrow(0.9) };
});

export const moving: Pose = t => {
  const { ready, advanced } = moveFrames();
  return lerpFrame(ready, advanced, loopPulse(t, 2.7));
};

const mergeFrames = once(() => {
  const merge = (approach: number) =>
    withTrail(
      kit(
        inShape([
          [0, -7.8],
          [3.2, -3.8],
          [1, -3.8],
          [1, -1],
          [-1, -1],
          [-1, -3.8],
          [-3.2, -3.8],
        ]),
        [0, -4],
        {
          balls: [
            [-5 + 1.2 * approach, 5 - 1.4 * approach, 2.5],
            [5 - 1.2 * approach, 5 - 1.4 * approach, 2.5],
          ],
          inks: [
            [-5 + 1.2 * approach, 5 - 1.4 * approach, 0, -1.5, 1.8],
            [5 - 1.2 * approach, 5 - 1.4 * approach, 0, -1.5, 1.8],
          ],
        },
      ),
    );
  return { separate: merge(0), converging: merge(1) };
});

export const merging: Pose = t => {
  const { separate, converging } = mergeFrames();
  return lerpFrame(separate, converging, loopPulse(t, 3.2));
};
