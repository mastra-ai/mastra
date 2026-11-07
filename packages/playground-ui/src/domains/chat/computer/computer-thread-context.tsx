import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { deriveComputers } from './computer-state';
import type { ComputerEntry } from './computer-state';

export interface ComputerThreadScope {
  threadId: string;
  resourceId: string;
}

interface ComputerThreadValue {
  computers: Map<string, ComputerEntry>;
  scope?: ComputerThreadScope;
}

const ComputerThreadContext = createContext<ComputerThreadValue>({ computers: new Map() });

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
  const value = useMemo<ComputerThreadValue>(
    () => ({ computers, scope: threadId && resourceId ? { threadId, resourceId } : undefined }),
    [computers, threadId, resourceId],
  );
  return <ComputerThreadContext.Provider value={value}>{children}</ComputerThreadContext.Provider>;
}

export const useComputerThread = () => useContext(ComputerThreadContext);
