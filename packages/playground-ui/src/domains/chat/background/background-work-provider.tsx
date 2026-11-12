import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { threadBackgroundWork } from './thread-background-work';
import { BackgroundWorkContext } from './use-thread-background-work';

/**
 * Reads the chat's background work once per message change, for every card, notice row and the
 * dock panel. Without it they see no background work.
 */
export function BackgroundWorkProvider({ messages, children }: { messages: MastraDBMessage[]; children: ReactNode }) {
  const work = useMemo(() => threadBackgroundWork(messages), [messages]);
  return <BackgroundWorkContext value={work}>{children}</BackgroundWorkContext>;
}
