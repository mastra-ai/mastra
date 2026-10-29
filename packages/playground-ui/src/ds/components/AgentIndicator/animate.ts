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
  const still = prefersReducedMotion();
  let clock = 0;
  let state: AgentIndicatorState | undefined;
  let enteredAt = 0;
  let leaving: ((t: number) => Frame) | undefined;
  let morph = 1;
  let onScreen = true;
  let frame = 0;
  let last = 0;

  const draw = () => {
    if (!state) return;
    let f = poses[state](clock, clock - enteredAt);
    if (leaving) {
      morph = clamp01((clock - enteredAt) / MORPH_SECONDS);
      if (morph >= 1) leaving = undefined;
      else f = lerpFrame(leaving(clock), f, ease(morph));
    }
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
    const running = onScreen && !still && !resting();
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
      if (state && !still) {
        const outgoing = poses[state];
        const outgoingAt = enteredAt;
        const current = (t: number) => outgoing(t, t - outgoingAt);
        const interrupted = leaving;
        const blend = ease(morph);
        leaving = interrupted ? t => lerpFrame(interrupted(t), current(t), blend) : current;
        morph = 0;
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
