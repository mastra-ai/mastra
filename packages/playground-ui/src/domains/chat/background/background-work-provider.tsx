import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { sameBackgroundWork, threadBackgroundWork } from './thread-background-work';
import type { ThreadBackgroundWork } from './thread-background-work';
import { ChatBackgroundWorkContext } from './use-chat-background-work';

/**
 * Reads the chat's background work once per message change, for every card, notice row and the
 * dock panel. While a turn streams text the work doesn't change, so the earlier value is kept and
 * its readers don't re-render on every token.
 */
export function BackgroundWorkProvider({ messages, children }: { messages: MastraDBMessage[]; children: ReactNode }) {
  const latest = useRef<ThreadBackgroundWork | undefined>(undefined);
  const work = useMemo(() => {
    const next = threadBackgroundWork(messages);
    if (latest.current && sameBackgroundWork(latest.current, next)) return latest.current;
    latest.current = next;
    return next;
  }, [messages]);
  return <ChatBackgroundWorkContext value={work}>{children}</ChatBackgroundWorkContext>;
}
