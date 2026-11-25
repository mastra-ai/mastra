import { playRigs } from './art-rigs';

const MOVERS = '.hold, .drawer, .swing, .rays, .bob, .flip, .lamp, .raise, .file, .filein, .mbfly, .mbin, .fx';
const FLOWS = '.reelspin, .stream, .belt, .job, .tick, .lamp4, .cart, .mdlamp path, .packet, .packet > *';
const PROPERTIES = [
  ['translate', 'translate'],
  ['rotate', 'rotate'],
  ['scale', 'scale'],
  ['opacity', 'opacity'],
  ['stroke-dashoffset', 'strokeDashoffset'],
  ['offset-distance', 'offsetDistance'],
  ['transform', 'transform'],
  ['--a', '--a'],
] as const;
const SETTLE = { duration: 650, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' };
const WIND_DOWN_MS = 900;

const flowTokens = new WeakMap<Element, number>();

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function snapshot(element: Element) {
  const style = getComputedStyle(element);
  return PROPERTIES.map(([css]) => style.getPropertyValue(css));
}

function cancelScripted(element: Element) {
  for (const animation of element.getAnimations()) {
    if (!(animation instanceof CSSAnimation)) animation.cancel();
  }
}

function easeBack(art: HTMLElement) {
  const elements = [...art.querySelectorAll(`${MOVERS}, .mbflag`)];
  const before = elements.map(element => ({ element, values: snapshot(element) }));
  elements.forEach(cancelScripted);
  art.removeAttribute('data-live');
  if (reducedMotion()) return;
  for (const { element, values } of before) {
    const after = snapshot(element);
    const from: Record<string, string> = {};
    const to: Record<string, string> = {};
    PROPERTIES.forEach(([, key], property) => {
      const was = values[property];
      const now = after[property];
      if (was !== undefined && now !== undefined && was !== now) {
        from[key] = was;
        to[key] = now;
      }
    });
    if (Object.keys(from).length > 0) element.animate([from, to], SETTLE);
  }
}

function windDown(art: HTMLElement) {
  const animations = [...art.querySelectorAll(FLOWS)].flatMap(element => element.getAnimations());
  const token = (flowTokens.get(art) ?? 0) + 1;
  flowTokens.set(art, token);
  const finish = () => {
    art.removeAttribute('data-flow');
    animations.forEach(animation => {
      animation.playbackRate = 1;
    });
  };
  if (reducedMotion()) return finish();
  const start = performance.now();
  const tick = (now: number) => {
    if (flowTokens.get(art) !== token) return;
    const progress = Math.min(1, (now - start) / WIND_DOWN_MS);
    const rate = Math.max((1 - progress) ** 2, 0.0001);
    animations.forEach(animation => {
      animation.playbackRate = rate;
    });
    if (progress < 1) requestAnimationFrame(tick);
    else finish();
  };
  requestAnimationFrame(tick);
}

function start(art: HTMLElement) {
  flowTokens.set(art, (flowTokens.get(art) ?? 0) + 1);
  for (const element of art.querySelectorAll(FLOWS)) {
    element.getAnimations().forEach(animation => {
      animation.playbackRate = 1;
    });
  }
  art.querySelectorAll(`${MOVERS}, .mbflag`).forEach(cancelScripted);
  art.setAttribute('data-live', '');
  art.setAttribute('data-flow', '');
}

function stop(art: HTMLElement) {
  easeBack(art);
  windDown(art);
}

export function trackArtMotion(art: HTMLElement | null) {
  if (!art) return;
  const host = art.closest('[data-slot="empty-state"]') ?? art;
  const onEnter = () => start(art);
  const onLeave = () => {
    if (!host.contains(document.activeElement)) stop(art);
  };
  const onFocusIn = () => {
    if (!art.hasAttribute('data-live')) start(art);
  };
  const onFocusOut = (event: Event) => {
    const next = event instanceof FocusEvent ? event.relatedTarget : undefined;
    if (next instanceof Node && host.contains(next)) return;
    if (!host.matches(':hover')) stop(art);
  };
  host.addEventListener('pointerenter', onEnter);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('focusin', onFocusIn);
  host.addEventListener('focusout', onFocusOut);
  const stopRigs = playRigs(art);
  return () => {
    stopRigs();
    host.removeEventListener('pointerenter', onEnter);
    host.removeEventListener('pointerleave', onLeave);
    host.removeEventListener('focusin', onFocusIn);
    host.removeEventListener('focusout', onFocusOut);
  };
}
