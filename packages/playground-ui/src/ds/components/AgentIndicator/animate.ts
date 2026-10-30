import { painter } from './paint';
import { MORPH_SECONDS, poses, restsAfterSeconds } from './poses';
import type { AgentIndicatorState } from './poses';
import { clamp01, cubicBezier, lerpFrame } from './shapes';
import type { Frame } from './shapes';

const ease = cubicBezier(0.65, 0, 0.35, 1);
const MAX_STEP_SECONDS = 0.05;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function animate(svg: SVGSVGElement) {
  const paint = painter(svg);
  const reduced = prefersReducedMotion();
  let clock = 0;
  let state: AgentIndicatorState | undefined;
  let enteredAt = 0;
  let leaving: ((t: number) => Frame) | undefined;
  let shown: Frame | undefined;
  let onScreen = true;
  let frame = 0;
  let last = 0;

  const draw = () => {
    if (!state) return;
    let f = poses[state](clock, clock - enteredAt);
    const morph = clamp01((clock - enteredAt) / MORPH_SECONDS);
    if (morph >= 1) leaving = undefined;
    if (leaving) f = lerpFrame(leaving(clock), f, ease(morph));
    shown = f;
    paint(f);
  };

  const resting = () => !leaving && state !== undefined && clock - enteredAt >= (restsAfterSeconds[state] ?? Infinity);

  const tick = (now: number) => {
    clock += Math.min(MAX_STEP_SECONDS, (now - last) / 1000);
    last = now;
    draw();
    frame = resting() ? 0 : requestAnimationFrame(tick);
  };

  const wake = () => {
    const running = onScreen && !reduced && !resting();
    if (running && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
    if (!running && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  const viewport = new IntersectionObserver(entries => {
    onScreen = entries.at(-1)?.isIntersecting ?? onScreen;
    wake();
  });
  viewport.observe(svg);

  return {
    show(next: AgentIndicatorState) {
      if (next === state) return;
      if (state && !reduced) {
        const outgoing = poses[state];
        const outgoingAt = enteredAt;
        const frozen = shown;
        leaving = leaving && frozen ? () => frozen : t => outgoing(t, t - outgoingAt);
      }
      state = next;
      enteredAt = clock;
      draw();
      wake();
    },
    stop() {
      cancelAnimationFrame(frame);
      viewport.disconnect();
    },
  };
}
