import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { SettledContext, useArriving } from './use-watched';
import { ARRIVING_CLASS } from '@/ds/tokens';
import { cn } from '@/lib/utils';

const ARRIVING_HOST = `.${ARRIVING_CLASS}`;

function finishEntrancesAround(marker: HTMLElement) {
  for (
    let host = marker.parentElement?.closest(ARRIVING_HOST);
    host;
    host = host.parentElement?.closest(ARRIVING_HOST)
  ) {
    if (typeof host.getAnimations !== 'function') return;
    for (const animation of host.getAnimations()) {
      if ('animationName' in animation && animation.animationName === ARRIVING_CLASS) animation.finish();
    }
  }
}

/**
 * Marks what the reader was handed. Whatever mounts with a scope is already there and
 * never animates; whatever mounts after it painted is the run happening in front of
 * them, and fades in.
 *
 * Scopes nest, and that is the whole rule: a transcript opens one for its history,
 * and every element that fades in opens one for its own subtree, so a row's contents
 * ride its entrance rather than playing a second one on top of it — while a detail
 * that fills in a beat later still gets its own.
 *
 * A ref, not state: this says when a child mounted, which is only ever read by a child
 * mounting. Holding it as state would re-render every scope and its subtree once each
 * after paint — a whole restored transcript rendered twice to tell it to sit still.
 */
export function ArrivalScope({ children }: { children: ReactNode }) {
  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
  }, []);

  return <SettledContext value={settled}>{children}</SettledContext>;
}

/**
 * Something the reader already sees, moved to a new place, such as the run's indicator stepping onto the line
 * that now describes it. It mounts without fading in, and takes the entrance off any element around it.
 */
export function Continuing({ children }: { children: ReactNode }) {
  const marker = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (marker.current) finishEntrancesAround(marker.current);
  }, []);

  return (
    <div ref={marker} className="contents">
      <ArrivalScope>{children}</ArrivalScope>
    </div>
  );
}

const UNWATCHED = { current: false };

/** Content whose entrance its host plays: nothing inside fades in on its own, as if no scope were watching. */
export function Unwatched({ children }: { children: ReactNode }) {
  return <SettledContext value={UNWATCHED}>{children}</SettledContext>;
}

/** An element that fades in when it lands, and hosts a scope for whatever lands inside it later. */
export function Arriving({ children, className }: { children: ReactNode; className?: string }) {
  const arriving = useArriving();

  return (
    <div className={cn(arriving, className)}>
      <ArrivalScope>{children}</ArrivalScope>
    </div>
  );
}
