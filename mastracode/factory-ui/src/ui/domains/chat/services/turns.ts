import type { TurnGroup } from '@mastra/playground-ui/components/ThreadRail';

import type { MessageEntry, TimelineEntry } from './transcript';

/**
 * The assistant entries one reply is spread over. The run engine sends the reply as one
 * message but the server persists one per step, so a turn the reader sees as a single
 * answer reaches the timeline as several — reloaded history always, and a live turn as
 * soon as the window is revalidated under it.
 */
export function replySteps(group: TurnGroup<TimelineEntry>): MessageEntry[] {
  return group.entries.flatMap(entry =>
    entry.kind === 'message' && entry.message.role === 'assistant' ? [entry] : [],
  );
}
