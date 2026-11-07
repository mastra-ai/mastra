import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { deriveComputers } from './computer-state';
import type { ComputerEntry, ComputerLiveControl } from './computer-state';

export interface ComputerThreadScope {
  threadId: string;
  resourceId: string;
}

interface ComputerThreadValue {
  computers: Map<string, ComputerEntry>;
  scope?: ComputerThreadScope;
  /** Latest server-reported control per computer; shared by the card and request prompts. */
  live: Map<string, ComputerLiveControl>;
  /** Identifies the displayed thread; a report started under another scope is dropped. */
  scopeKey: string;
  /**
   * Reports a control read or change. Pass the `scopeKey` current when the request
   * started, and for reads the `readEpoch` taken then: a read that started before
   * the latest change, or anything started on another thread, is stale and dropped.
   */
  reportControl: (
    computerId: string,
    control: Omit<ComputerLiveControl, 'basis'>,
    started: { scopeKey: string; epoch?: number },
  ) => void;
  readEpoch: (computerId: string) => number;
}

const ComputerThreadContext = createContext<ComputerThreadValue>({
  computers: new Map(),
  live: new Map(),
  scopeKey: '',
  reportControl: () => {},
  readEpoch: () => 0,
});

export interface ComputerThreadProviderProps {
  messages: MastraDBMessage[];
  /** The displayed thread. Without it, computer cards show names only and never connect. */
  scope?: ComputerThreadScope;
  children: ReactNode;
}

/**
 * Thread-level computer state for chat renderers, which each see only one part.
 *
 * @experimental
 */
export function ComputerThreadProvider({ messages, scope, children }: ComputerThreadProviderProps) {
  const computers = useMemo(() => deriveComputers(messages), [messages]);
  const threadId = scope?.threadId;
  const resourceId = scope?.resourceId;
  // Live control belongs to one thread: switching threads starts empty, so a computer
  // reused across threads never inherits the previous thread's holder.
  const scopeKey = JSON.stringify([resourceId ?? null, threadId ?? null]);
  const [state, setState] = useState(() => ({ scopeKey, live: new Map<string, ComputerLiveControl>() }));
  const live = useMemo(
    () => (state.scopeKey === scopeKey ? state.live : new Map<string, ComputerLiveControl>()),
    [state, scopeKey],
  );
  // Read through refs so streaming messages don't recreate the callback and restart polls.
  const computersRef = useRef(computers);
  computersRef.current = computers;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  // Epochs are keyed by thread too, so a switch starts every computer at zero.
  const epochs = useRef(new Map<string, number>());
  const epochKey = (computerId: string) => `${scopeRef.current}\n${computerId}`;
  const readEpoch = useCallback((computerId: string) => epochs.current.get(epochKey(computerId)) ?? 0, []);
  const reportControl = useCallback(
    (
      computerId: string,
      control: Omit<ComputerLiveControl, 'basis'>,
      started: { scopeKey: string; epoch?: number },
    ) => {
      if (started.scopeKey !== scopeRef.current) return;
      if (started.epoch === undefined) epochs.current.set(epochKey(computerId), readEpoch(computerId) + 1);
      else if (started.epoch !== readEpoch(computerId)) return;
      setState(stored => {
        const key = started.scopeKey;
        const previous = stored.scopeKey === key ? stored.live : new Map<string, ComputerLiveControl>();
        const current = previous.get(computerId);
        const basis = computersRef.current.get(computerId)?.holder ?? 'agent';
        // A poll repeating the same holder keeps the last change's notified flag.
        const notified = control.notified ?? (current?.holder === control.holder ? current.notified : undefined);
        if (
          stored.scopeKey === key &&
          current?.holder === control.holder &&
          current.basis === basis &&
          current.notified === notified
        )
          return stored;
        const next = new Map(previous);
        next.set(computerId, { holder: control.holder, basis, ...(notified !== undefined && { notified }) });
        return { scopeKey: key, live: next };
      });
    },
    [readEpoch],
  );
  const value = useMemo<ComputerThreadValue>(
    () => ({
      computers,
      scope: threadId && resourceId ? { threadId, resourceId } : undefined,
      live,
      scopeKey,
      reportControl,
      readEpoch,
    }),
    [computers, threadId, resourceId, live, scopeKey, reportControl, readEpoch],
  );
  return <ComputerThreadContext.Provider value={value}>{children}</ComputerThreadContext.Provider>;
}

export const useComputerThread = () => useContext(ComputerThreadContext);
