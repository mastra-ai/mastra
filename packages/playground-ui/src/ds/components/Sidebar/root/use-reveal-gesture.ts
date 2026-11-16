import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';

const EASE = [0.32, 0.72, 0, 1] as const;
const EASE_START_SLOPE = EASE[1] / EASE[0];
export const REVEAL_EASE = `cubic-bezier(${EASE.join(', ')})`;

const DRAG_VAR = '--sidebar-reveal-drag';
const DURATION_VAR = '--sidebar-reveal-duration';

const LOCK_DISTANCE_PX = 8;
const TURN_DISTANCE_PX = 8;
const COMMIT_DISTANCE_PX = 40;
const VELOCITY_WINDOW_MS = 100;
const MIN_SETTLE_MS = 120;
const MAX_SETTLE_MS = 400;

type Sample = { x: number; t: number };

type Track = {
  touchId: number;
  startX: number;
  startY: number;
  target: Element | undefined;
  locked: boolean;
  startedOpen: boolean;
  origin: number;
  offset: number;
  heading: number;
  turn: number;
  width: number;
  layers: HTMLElement[];
  samples: Sample[];
};

type RevealGestureOptions = {
  scopeRef: RefObject<HTMLElement | null>;
  open: boolean;
  onGrab: () => void;
  onRelease: (open: boolean) => void;
  onSettled: () => void;
};

export function useRevealGesture({ scopeRef, open, onGrab, onRelease, onSettled }: RevealGestureOptions) {
  const settleRef = useRef(0);
  const isOpen = useEffectEvent(() => open);
  const handleGrab = useEffectEvent(onGrab);
  const handleRelease = useEffectEvent(onRelease);
  const handleSettled = useEffectEvent(onSettled);

  const settle = useEffectEvent(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const token = ++settleRef.current;
    requestAnimationFrame(() => {
      const running = revealLayers(scope).flatMap(layer => layer.getAnimations());
      void Promise.allSettled(running.map(animation => animation.finished)).then(() => {
        if (token !== settleRef.current) return;
        clearRevealVar(revealLayers(scope), DURATION_VAR);
        handleSettled();
      });
    });
  });

  useEffect(() => {
    settle();
  }, [open]);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const settles = settleRef;
    let track: Track | undefined;

    const release = (ended: Track, velocity: number) => {
      const committed = Math.abs(ended.offset - ended.origin) >= COMMIT_DISTANCE_PX;
      const endsOpen = committed ? ended.heading > 0 : ended.startedOpen;
      const distance = Math.abs((endsOpen ? ended.width : 0) - ended.offset);
      const speedTowardTarget = endsOpen ? velocity : -velocity;
      setRevealVar(ended.layers, DURATION_VAR, `${settleDuration(distance, speedTowardTarget)}ms`);
      clearRevealVar(ended.layers, DRAG_VAR);
      handleRelease(endsOpen);
      settle();
    };

    const lock = (current: Track, touch: Touch) => {
      const dx = touch.clientX - current.startX;
      const dy = touch.clientY - current.startY;
      if (Math.hypot(dx, dy) < LOCK_DISTANCE_PX) return 'pending';

      const layers = revealLayers(scope);
      const width = layerNamed(layers, 'panel')?.offsetWidth ?? 0;
      const opening = !isOpen();
      if (!width || Math.abs(dx) <= Math.abs(dy) || dx > 0 !== opening) return 'ignored';
      if (ownsHorizontalSwipe(current.target, scope, dx)) return 'ignored';

      current.locked = true;
      current.startedOpen = !opening;
      current.width = width;
      current.startX += Math.sign(dx) * LOCK_DISTANCE_PX;
      current.origin = liveOffset(layerNamed(layers, 'scrim')) ?? (opening ? 0 : width);
      current.heading = Math.sign(dx);
      current.turn = current.origin;
      current.layers = layers;
      setRevealVar(layers, DURATION_VAR, '0ms');
      settleRef.current++;
      handleGrab();
      return 'locked';
    };

    const onTouchStart = (event: TouchEvent) => {
      const ongoing = track;
      track = undefined;
      if (ongoing?.locked) release(ongoing, 0);
      const touch = event.touches[0];
      if (event.touches.length !== 1 || !touch) return;

      track = {
        touchId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        target: event.target instanceof Element ? event.target : undefined,
        locked: false,
        startedOpen: false,
        origin: 0,
        offset: 0,
        heading: 0,
        turn: 0,
        width: 0,
        layers: [],
        samples: [{ x: touch.clientX, t: event.timeStamp }],
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const current = track;
      const touch = current && Array.from(event.changedTouches).find(t => t.identifier === current.touchId);
      if (!current || !touch) return;

      current.samples.push({ x: touch.clientX, t: event.timeStamp });
      current.samples.splice(
        0,
        current.samples.findIndex(sample => event.timeStamp - sample.t <= VELOCITY_WINDOW_MS),
      );
      if (!current.locked) {
        const state = lock(current, touch);
        if (state === 'ignored') track = undefined;
        if (state !== 'locked') return;
      }

      if (event.cancelable) event.preventDefault();
      current.offset = Math.min(current.width, Math.max(0, current.origin + touch.clientX - current.startX));
      steer(current);
      setRevealVar(current.layers, DRAG_VAR, String(current.offset / current.width));
    };

    const onTouchEnd = (event: TouchEvent) => {
      const ended = track;
      if (!ended || !Array.from(event.changedTouches).some(t => t.identifier === ended.touchId)) return;
      track = undefined;
      if (!ended.locked) return;
      release(ended, event.type === 'touchcancel' ? 0 : velocityAt(ended.samples, event.timeStamp));
    };

    scope.addEventListener('touchstart', onTouchStart, { passive: true });
    scope.addEventListener('touchmove', onTouchMove, { passive: false });
    scope.addEventListener('touchend', onTouchEnd);
    scope.addEventListener('touchcancel', onTouchEnd);
    return () => {
      scope.removeEventListener('touchstart', onTouchStart);
      scope.removeEventListener('touchmove', onTouchMove);
      scope.removeEventListener('touchend', onTouchEnd);
      scope.removeEventListener('touchcancel', onTouchEnd);
      settles.current++;
      const layers = revealLayers(scope);
      clearRevealVar(layers, DRAG_VAR);
      clearRevealVar(layers, DURATION_VAR);
    };
  }, [scopeRef]);
}

function revealLayers(scope: ParentNode) {
  return Array.from(scope.querySelectorAll<HTMLElement>('[data-sidebar-reveal-layer]'));
}

function layerNamed(layers: readonly HTMLElement[], name: 'panel' | 'scrim') {
  return layers.find(layer => layer.dataset.sidebarRevealLayer === name);
}

function setRevealVar(layers: readonly HTMLElement[], name: string, value: string) {
  for (const layer of layers) layer.style.setProperty(name, value);
}

function clearRevealVar(layers: readonly HTMLElement[], name: string) {
  for (const layer of layers) layer.style.removeProperty(name);
}

function settleDuration(distance: number, speedTowardTarget: number) {
  const velocityMatched =
    speedTowardTarget > 0 ? (EASE_START_SLOPE * distance) / speedTowardTarget : Number.POSITIVE_INFINITY;
  return Math.round(Math.min(MAX_SETTLE_MS, Math.max(MIN_SETTLE_MS, velocityMatched)));
}

function steer(track: Track) {
  const travel = track.offset - track.turn;
  if (travel * track.heading > 0) {
    track.turn = track.offset;
  } else if (Math.abs(travel) >= TURN_DISTANCE_PX) {
    track.heading = -track.heading;
    track.turn = track.offset;
  }
}

function velocityAt(samples: Sample[], now: number) {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last || last.t === first.t || now - last.t > VELOCITY_WINDOW_MS) return 0;
  return (last.x - first.x) / (last.t - first.t);
}

function liveOffset(element: HTMLElement | undefined) {
  if (!element) return undefined;
  const offset = Number.parseFloat(getComputedStyle(element).translate);
  return Number.isFinite(offset) ? offset : undefined;
}

function ownsHorizontalSwipe(target: Element | undefined, scope: Element, dx: number) {
  for (let node: Element | null | undefined = target; node && node !== scope; node = node.parentElement) {
    if (node instanceof HTMLInputElement && node.type === 'range') return true;

    const style = getComputedStyle(node);
    if (style.touchAction && !/auto|manipulation|pan-x/.test(style.touchAction)) return true;

    const scrollable = /auto|scroll/.test(style.overflowX) && node.scrollWidth > node.clientWidth;
    const canScrollToward = dx > 0 ? node.scrollLeft > 0 : node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
    if (scrollable && canScrollToward) return true;
  }
  return false;
}
