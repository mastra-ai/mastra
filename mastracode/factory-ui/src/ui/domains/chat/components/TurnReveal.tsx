import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

interface TurnReveal {
  mark(entryId: string, revealing: boolean): void;
  subscribe(listener: () => void): () => void;
  landed(): boolean;
}

function createTurnReveal(): TurnReveal {
  const revealing = new Set<string>();
  const listeners = new Set<() => void>();
  return {
    mark(entryId, isRevealing) {
      if (isRevealing === revealing.has(entryId)) return;
      if (isRevealing) revealing.add(entryId);
      else revealing.delete(entryId);
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    landed: () => revealing.size === 0,
  };
}

const ALWAYS_LANDED: TurnReveal = { mark() {}, subscribe: () => () => {}, landed: () => true };

const TurnRevealContext = createContext<TurnReveal>(ALWAYS_LANDED);

/** One turn's messages each write themselves in on their own clock; this tells them apart from a turn fully on screen. */
export function TurnRevealScope({ children }: { children: ReactNode }) {
  const [reveal] = useState(createTurnReveal);
  return <TurnRevealContext value={reveal}>{children}</TurnRevealContext>;
}

/** Reports whether this entry is still writing itself in, and answers whether every entry of its turn has landed. */
export function useTurnLanded(entryId: string, revealing: boolean): boolean {
  const reveal = useContext(TurnRevealContext);
  useLayoutEffect(() => {
    reveal.mark(entryId, revealing);
    return () => reveal.mark(entryId, false);
  }, [reveal, entryId, revealing]);
  return useSyncExternalStore(reveal.subscribe, reveal.landed);
}
