import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';

const EASE = [0.32, 0.72, 0, 1] as const;
const EASE_START_SLOPE = EASE[1] / EASE[0];
export const REVEAL_EASE = `cubic-bezier(${EASE.join(', ')})`;

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

export type RevealSide = 'left' | 'right';

/** The two edge drawers that share a scope. */
export type RevealName = 'sidebar' | 'aside';

type RevealGestureOptions = {
  scopeRef: RefObject<HTMLElement | null>;
  /**
   * The drawer holding the scope while open, dragged, or settling closed. Shared by both drawers so only one is ever
   * out: a swipe that would start one is ignored while the other holds it.
   */
  ownerRef: RefObject<RevealName | null>;
  /** Namespaces the layer attribute (`data-<name>-reveal-layer`) and the drag variables (`--<name>-reveal-*`). */
  name: RevealName;
  /** The screen edge the panel sits on. A left panel opens on a rightward swipe, a right panel on a leftward one. */
  side: RevealSide;
  open: boolean;
  onGrab: () => void;
  onRelease: (open: boolean) => void;
  onSettled: () => void;
};

export function useRevealGesture({
  scopeRef,
  ownerRef,
  name,
  side,
  open,
  onGrab,
  onRelease,
  onSettled,
}: RevealGestureOptions) {
  const settleRef = useRef(0);
  const layerAttr = `data-${name}-reveal-layer`;
  const dragVar = `--${name}-reveal-drag`;
  const durationVar = `--${name}-reveal-duration`;
  // Distances are tracked toward "open": positive opens whichever edge the panel is on.
  const toward = side === 'left' ? 1 : -1;
  const isOpen = useEffectEvent(() => open);
  const handleGrab = useEffectEvent(onGrab);
  const handleRelease = useEffectEvent(onRelease);
  const handleSettled = useEffectEvent(onSettled);

  const settle = useEffectEvent(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const token = ++settleRef.current;
    requestAnimationFrame(() => {
      const running = revealLayers(scope, layerAttr).flatMap(layer => layer.getAnimations());
      void Promise.allSettled(running.map(animation => animation.finished)).then(() => {
        if (token !== settleRef.current) return;
        clearRevealVar(revealLayers(scope, layerAttr), durationVar);
        if (!isOpen()) releaseOwner(ownerRef, name);
        handleSettled();
      });
    });
  });

  useEffect(() => {
    if (open) ownerRef.current = name;
    settle();
  }, [open, ownerRef, name]);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const settles = settleRef;
    let track: Track | undefined;

    const release = (ended: Track, velocity: number) => {
      const committed = Math.abs(ended.offset - ended.origin) >= COMMIT_DISTANCE_PX;
      const endsOpen = committed ? ended.heading > 0 : ended.startedOpen;
      const distance = Math.abs((endsOpen ? ended.width : 0) - ended.offset);
      const speedTowardTarget = (endsOpen ? velocity : -velocity) * toward;
      setRevealVar(ended.layers, durationVar, `${settleDuration(distance, speedTowardTarget)}ms`);
      clearRevealVar(ended.layers, dragVar);
      handleRelease(endsOpen);
      settle();
    };

    const lock = (current: Track, touch: Touch) => {
      const dx = touch.clientX - current.startX;
      const dy = touch.clientY - current.startY;
      if (Math.hypot(dx, dy) < LOCK_DISTANCE_PX) return 'pending';

      if (ownerRef.current && ownerRef.current !== name) return 'ignored';
      const layers = revealLayers(scope, layerAttr);
      const width = layerNamed(layers, layerAttr, 'panel')?.offsetWidth ?? 0;
      const opening = !isOpen();
      if (!width || Math.abs(dx) <= Math.abs(dy) || dx * toward > 0 !== opening) return 'ignored';
      if (ownsHorizontalSwipe(current.target, scope, dx)) return 'ignored';

      current.locked = true;
      current.startedOpen = !opening;
      current.width = width;
      current.startX += Math.sign(dx) * LOCK_DISTANCE_PX;
      const live = liveOffset(layerNamed(layers, layerAttr, 'scrim'));
      current.origin = live === undefined ? (opening ? 0 : width) : live * toward;
      current.heading = Math.sign(dx * toward);
      current.turn = current.origin;
      current.layers = layers;
      setRevealVar(layers, durationVar, '0ms');
      settleRef.current++;
      ownerRef.current = name;
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
      current.offset = Math.min(current.width, Math.max(0, current.origin + (touch.clientX - current.startX) * toward));
      steer(current);
      setRevealVar(current.layers, dragVar, String(current.offset / current.width));
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
      const layers = revealLayers(scope, layerAttr);
      clearRevealVar(layers, dragVar);
      clearRevealVar(layers, durationVar);
      releaseOwner(ownerRef, name);
    };
  }, [scopeRef, ownerRef, layerAttr, dragVar, durationVar, name, toward]);
}

function revealLayers(scope: ParentNode, layerAttr: string) {
  return Array.from(scope.querySelectorAll<HTMLElement>(`[${layerAttr}]`));
}

function layerNamed(layers: readonly HTMLElement[], layerAttr: string, name: 'panel' | 'scrim') {
  return layers.find(layer => layer.getAttribute(layerAttr) === name);
}

function releaseOwner(ownerRef: RefObject<RevealName | null>, name: RevealName) {
  if (ownerRef.current === name) ownerRef.current = null;
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
