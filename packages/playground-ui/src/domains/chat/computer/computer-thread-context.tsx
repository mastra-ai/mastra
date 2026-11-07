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
  reportControl: (computerId: string, control: Omit<ComputerLiveControl, 'basis'>) => void;
}

const ComputerThreadContext = createContext<ComputerThreadValue>({
  computers: new Map(),
  live: new Map(),
  reportControl: () => {},
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
  const [live, setLive] = useState<Map<string, ComputerLiveControl>>(() => new Map());
  // Read through a ref so streaming messages don't recreate the callback and restart polls.
  const computersRef = useRef(computers);
  computersRef.current = computers;
  const reportControl = useCallback(
    (computerId: string, control: Omit<ComputerLiveControl, 'basis'>) =>
      setLive(previous => {
        const current = previous.get(computerId);
        const basis = computersRef.current.get(computerId)?.holder ?? 'agent';
        // A poll repeating the same holder keeps the last change's notified flag.
        const notified = control.notified ?? (current?.holder === control.holder ? current.notified : undefined);
        if (current?.holder === control.holder && current.basis === basis && current.notified === notified)
          return previous;
        const next = new Map(previous);
        next.set(computerId, { holder: control.holder, basis, ...(notified !== undefined && { notified }) });
        return next;
      }),
    [],
  );
  const value = useMemo<ComputerThreadValue>(
    () => ({ computers, scope: threadId && resourceId ? { threadId, resourceId } : undefined, live, reportControl }),
    [computers, threadId, resourceId, live, reportControl],
  );
  return <ComputerThreadContext.Provider value={value}>{children}</ComputerThreadContext.Provider>;
}

export const useComputerThread = () => useContext(ComputerThreadContext);
