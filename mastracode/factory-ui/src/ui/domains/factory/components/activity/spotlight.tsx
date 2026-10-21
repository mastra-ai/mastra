import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import { entryRunId, entryTarget } from '../../activity';
import type { ActivityEntry } from '../../activity';

export type SpotlightState = 'spotlit' | 'dimmed' | 'idle';

export interface BarsInView {
  runIds: ReadonlySet<string>;
  cardIds: ReadonlySet<string>;
}

interface SpotlightTarget {
  key: string;
  from: 'bar' | 'row';
  runIds: ReadonlyArray<string>;
  cardIds: ReadonlyArray<string>;
}

interface SpotlightStore {
  current: () => SpotlightTarget | undefined;
  subscribe: (listener: () => void) => () => void;
  show: (target: SpotlightTarget) => void;
  hide: (key: string) => void;
}

function createSpotlightStore(): SpotlightStore {
  let target: SpotlightTarget | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: SpotlightTarget | undefined) => {
    if (next?.key === target?.key) return;
    target = next;
    for (const listener of listeners) listener();
  };
  return {
    current: () => target,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    show: publish,
    hide: leavingKey => {
      if (leavingKey === target?.key) publish(undefined);
    },
  };
}

const SpotlightContext = createContext<SpotlightStore | undefined>(undefined);

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createSpotlightStore);
  return <SpotlightContext value={store}>{children}</SpotlightContext>;
}

function useSpotlightStore(): SpotlightStore {
  const store = useContext(SpotlightContext);
  if (store === undefined) throw new Error('Spotlight hooks need a SpotlightProvider above them');
  return store;
}

function spotlightTarget(
  from: SpotlightTarget['from'],
  runIds: ReadonlyArray<string>,
  cardIds: ReadonlyArray<string>,
): SpotlightTarget {
  return { key: `${from}:${runIds.join()}:${cardIds.join()}`, from, runIds, cardIds };
}

function targets(
  target: SpotlightTarget,
  hasRun: (runId: string) => boolean,
  hasCard: (cardId: string) => boolean,
): boolean {
  return target.runIds.length > 0 ? target.runIds.some(hasRun) : target.cardIds.some(hasCard);
}

function useSpotlight(target: SpotlightTarget, stateOf: (spotlit: SpotlightTarget | undefined) => SpotlightState) {
  const store = useSpotlightStore();
  const snapshot = () => stateOf(store.current());
  const state = useSyncExternalStore(store.subscribe, snapshot, snapshot);
  const { key } = target;
  useEffect(() => () => store.hide(key), [store, key]);

  return {
    state,
    handlers: {
      onPointerEnter: () => store.show(target),
      onPointerLeave: () => store.hide(key),
      onFocus: () => store.show(target),
      onBlur: () => store.hide(key),
    },
  };
}

export function useBarSpotlight(runId: string, cardId: string | undefined, barsInView: BarsInView) {
  const target = spotlightTarget('bar', [runId], cardId === undefined ? [] : [cardId]);
  return useSpotlight(target, spotlit => {
    if (spotlit === undefined) return 'idle';
    if (
      targets(
        spotlit,
        id => id === runId,
        id => id === cardId,
      )
    )
      return 'spotlit';
    if (spotlit.from === 'bar') return 'dimmed';
    if (
      targets(
        spotlit,
        id => barsInView.runIds.has(id),
        id => barsInView.cardIds.has(id),
      )
    )
      return 'dimmed';
    return 'idle';
  });
}

export function useSpotlitBarRunId(): string | undefined {
  const store = useSpotlightStore();
  const snapshot = () => {
    const spotlit = store.current();
    return spotlit?.from === 'bar' ? spotlit.runIds[0] : undefined;
  };
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

export function useEntriesSpotlight(entries: ReadonlyArray<ActivityEntry>) {
  const runIds = [...new Set(entries.flatMap(entry => entryRunId(entry) ?? []))];
  const cardIds = [...new Set(entries.flatMap(entry => entryTarget(entry)?.id ?? []))];
  return useSpotlight(spotlightTarget('row', runIds, cardIds), spotlit =>
    spotlit?.from === 'bar' &&
    targets(
      spotlit,
      id => runIds.includes(id),
      id => cardIds.includes(id),
    )
      ? 'spotlit'
      : 'idle',
  );
}
