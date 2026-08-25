import { ARRIVING_CLASS } from '@mastra/playground-ui/tokens';
import { cn } from '@mastra/playground-ui/utils/cn';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/** Outside any scope nothing is watched arriving, so nothing animates. */
const SettledContext = createContext<{ readonly current: boolean }>({ current: false });

/**
 * Marks what the reader was handed. Whatever mounts with a scope is already there and
 * never animates; whatever mounts after it painted is the run happening in front of
 * them, and fades in.
 *
 * Scopes nest, and that is the whole rule: the transcript opens one for its history,
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

/** The entrance class if this element mounted while the reader was watching, nothing otherwise. */
export function useArriving(): string | undefined {
  const settled = useContext(SettledContext);
  const [arriving] = useState(() => settled.current);

  return arriving ? ARRIVING_CLASS : undefined;
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
