import type { MastraDBMessage } from '@mastra/core/agent/message-list';

import { createInitialTranscript } from '@/domains/chat/transcript/services/transcript';
import type { NoticeEntry, TranscriptState } from '@/domains/chat/transcript/services/transcript';

/**
 * A managed-agent thread has no event stream to fold: `useChat` already keeps the
 * thread as stored messages, live parts included. The transcript is rebuilt from them.
 */
export function managedAgentTranscript({
  messages,
  threadId,
  running,
  notices = [],
  resolvedPrompts,
}: {
  messages: MastraDBMessage[];
  threadId?: string;
  running: boolean;
  notices?: readonly NoticeEntry[];
  resolvedPrompts?: ReadonlySet<string>;
}): TranscriptState {
  const transcript = createInitialTranscript({ messages, threadId });
  const entries = resolvedPrompts?.size
    ? transcript.entries.filter(entry => !(isPrompt(entry) && resolvedPrompts.has(entry.id)))
    : transcript.entries;
  return { ...transcript, entries: [...entries, ...notices], pending: running };
}

function isPrompt(entry: TranscriptState['entries'][number]): boolean {
  return entry.kind === 'approval' || entry.kind === 'suspension';
}
