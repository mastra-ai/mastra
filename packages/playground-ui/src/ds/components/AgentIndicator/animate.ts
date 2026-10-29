import { painter } from './paint';
import { MORPH_SECONDS, poses } from './poses';
import type { AgentIndicatorState, Pose } from './poses';
import { clamp01, cubicBezier, lerpFrame } from './shapes';
import type { Frame } from './shapes';

const ease = cubicBezier(0.65, 0, 0.35, 1);
const MAX_STEP_SECONDS = 0.05;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function animate(svg: SVGSVGElement) {
  const paint = painter(svg);
  const still = prefersReducedMotion();
  let clock = 0;
  let pose: Pose | undefined;
  let enteredAt = 0;
  let leaving: ((t: number) => Frame) | undefined;
  let morph = 1;
  let frame = 0;
  let last = performance.now();

  const draw = () => {
    if (!pose) return;
    let f = pose(clock, clock - enteredAt);
    if (leaving) {
      morph = clamp01((clock - enteredAt) / MORPH_SECONDS);
      if (morph >= 1) leaving = undefined;
      else f = lerpFrame(leaving(clock), f, ease(morph));
    }
    paint(f);
  };

  const tick = (now: number) => {
    clock += Math.min(MAX_STEP_SECONDS, (now - last) / 1000);
    last = now;
    draw();
    frame = requestAnimationFrame(tick);
  };
  if (!still) frame = requestAnimationFrame(tick);

  return {
    show(state: AgentIndicatorState) {
      const next = poses[state];
      if (next === pose) return;
      if (pose && !still) {
        const outgoing = pose;
        const outgoingAt = enteredAt;
        const current = (t: number) => outgoing(t, t - outgoingAt);
        const interrupted = leaving;
        const blend = ease(morph);
        leaving = interrupted ? t => lerpFrame(interrupted(t), current(t), blend) : current;
        morph = 0;
      }
      pose = next;
      enteredAt = clock;
      draw();
    },
    stop() {
      cancelAnimationFrame(frame);
    },
  };
}
