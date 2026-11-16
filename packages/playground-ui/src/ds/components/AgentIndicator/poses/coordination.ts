import type { Pose } from '../poses';
import {
  anyOf,
  inCirc,
  inRoundRect,
  inShape,
  kit,
  lerpFrame,
  loopPulse,
  once,
  polyline,
  sstep,
  withTrail,
} from '../shapes';

const delegationFrames = once(() => {
  const handoff = (received: number) =>
    withTrail(
      kit(inRoundRect(-3, 3.5, 3.8, 3, 2.5), [-3, 3.5], {
        balls: [
          [-3, -3.8, 2.5],
          [4.6, -1.6 - 0.7 * received, 2.2 + 0.25 * received],
        ],
        inks: [[0, 3, 3, 3.5, 1.6 * received]],
      }),
      polyline(
        [
          [3, 5 - 0.4 * received],
          [6.6, 5 - 0.4 * received],
        ],
        3.4 + 0.3 * received,
        0,
      ),
    );
  return { ready: handoff(0), received: handoff(1) };
});

export const delegating: Pose = t => {
  const { ready, received } = delegationFrames();
  return lerpFrame(ready, received, loopPulse(t, 3.1));
};

const workflowFrames = once(() => {
  const flow = (progress: number, radius: number) =>
    withTrail(
      kit(inRoundRect(0, -5, 2.9, 2.3, 1.2), [0, -5], {
        balls: [
          [-4.8 * progress, -2.8 + 7.6 * progress, radius],
          [4.8 * progress, -2.8 + 7.6 * progress, radius],
        ],
        inks: [
          [0, -2.8, -4.8, 4.8, 1.7],
          [0, -2.8, 4.8, 4.8, 1.7],
        ],
      }),
      [
        ...polyline(
          [
            [-5.3, 4.8],
            [-4.3, 4.8],
          ],
          4.8,
          0,
        ),
        ...polyline(
          [
            [4.3, 4.8],
            [5.3, 4.8],
          ],
          4.8,
          0,
        ),
      ],
    );
  return { resting: flow(0, 0), leaving: flow(0, 1.5), arriving: flow(1, 1.5), arrived: flow(1, 0) };
});

export const workflow: Pose = t => {
  const { resting, leaving, arriving, arrived } = workflowFrames();
  const phase = (t / 3.2) % 1;
  const progress = sstep(0.12, 0.58, phase) * (1 - sstep(0.76, 0.94, phase));
  const visible = sstep(0.03, 0.12, phase) * (1 - sstep(0.6, 0.74, phase));
  return lerpFrame(lerpFrame(resting, arrived, progress), lerpFrame(leaving, arriving, progress), visible);
};

const connectionFrames = once(() => {
  const plug = (lift: number) =>
    withTrail(
      kit(inRoundRect(0, -1.2 - lift, 4.5, 3.3, 2), [0, -1.2 - lift], {
        inks: [
          [-2.2, -7.2 - lift, -2.2, -3.5 - lift, 2.1],
          [2.2, -7.2 - lift, 2.2, -3.5 - lift, 2.1],
        ],
      }),
      polyline(
        [
          [0, 2 - lift],
          [0, 4.8],
          [0.5, 6],
          [1.5, 6.6],
          [4.5, 6.6],
        ],
        2.1,
        0,
      ),
    );
  return { ready: plug(0), inserted: plug(0.8) };
});

export const connecting: Pose = t => {
  const { ready, inserted } = connectionFrames();
  return lerpFrame(ready, inserted, loopPulse(t, 3.3));
};

const planningFrames = once(() => {
  const checklist = (checked: number) =>
    withTrail(
      kit(anyOf(inRoundRect(0, 1, 6.2, 6.6, 1.8), inRoundRect(0, -5.6, 3, 1.8, 1)), [0, 0], {
        cuts: [
          [0, -0.1, 3.5, -0.1, 1.8],
          [-0.8, 3.6, 3.5, 3.6, 1.8],
        ],
      }),
      [
        ...polyline(
          [
            [-3.5 - checked, -0.1],
            [-3.5, -0.1 + checked],
          ],
          0,
          1.8,
        ),
        ...polyline(
          [
            [-3.5, -0.1 + checked],
            [-3.5 + 1.8 * checked, -0.1 - 1.5 * checked],
          ],
          0,
          1.8 * checked,
        ),
        ...polyline(
          [
            [-3.5, 3.6],
            [-3.5, 3.6],
          ],
          0,
          1.8,
        ),
        ...polyline(
          [
            [-2, -4.3],
            [2, -4.3],
          ],
          0,
          1.5,
        ),
      ],
    );
  return { pending: checklist(0), checked: checklist(1) };
});

export const planning: Pose = t => {
  const { pending, checked } = planningFrames();
  return lerpFrame(pending, checked, loopPulse(t, 3.4));
};

const messageFrames = once(() => {
  const bubble = (liftedDot: number) =>
    withTrail(
      kit(
        anyOf(
          inRoundRect(0, -1.2, 7, 5.2, 2.8),
          inShape([
            [-4.8, 2],
            [-5.5, 7],
            [0, 3.8],
          ]),
        ),
        [0, -0.5],
      ),
      [-3.4, 0, 3.4].flatMap((x, index) => {
        const y = index === liftedDot ? -2.5 : -1.2;
        return polyline(
          [
            [x, y],
            [x, y],
          ],
          0,
          2,
        );
      }),
    );
  return { resting: bubble(-1), first: bubble(0), second: bubble(1), third: bubble(2) };
});

export const messaging: Pose = t => {
  const { resting, first, second, third } = messageFrames();
  const phase = (t / 3.6) % 1;
  const beat = (start: number) => sstep(start, start + 0.09, phase) * (1 - sstep(start + 0.2, start + 0.29, phase));
  return lerpFrame(lerpFrame(lerpFrame(resting, first, beat(0.05)), second, beat(0.22)), third, beat(0.39));
};

const branchFrames = once(() => {
  const branch = (extension: number) =>
    withTrail(
      kit(inCirc(-4, 5.5, 2.5), [-4, 5.5], {
        balls: [
          [-4, -5.5, 2.5],
          [5 + extension, -4 - extension, 2.5 + 0.3 * extension],
        ],
        inks: [[-4, 4, -4, -4, 1.8]],
      }),
      polyline(
        [
          [-4, 2.5],
          [-1.8, 2.3],
          [0.5, 1.4],
          [2.6, -0.3],
          [4.2 + extension, -2.3 - extension],
          [5 + extension, -4 - extension],
        ],
        1.8,
        0,
      ),
    );
  return { ready: branch(0), extended: branch(0.7) };
});

export const branching: Pose = t => {
  const { ready, extended } = branchFrames();
  return lerpFrame(ready, extended, loopPulse(t, 3.5));
};
