import { Shimmer } from '@mastra/playground-ui/components/Shimmer';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useChatTranscript } from '../context/useChatTranscript';
import { isTerminalInvocationState } from '../services/transcript';
import type { TimelineEntry } from '../services/transcript';

/** Whether the transcript already shows the run is alive: a running tool row, or a card waiting on the user. */
function hasVisibleActivity(entries: TimelineEntry[]): boolean {
  const last = entries.at(-1);
  if (!last) return false;
  if (last.kind !== 'message') return true;
  return (last.message.content.parts ?? []).some(
    part => part.type === 'tool-invocation' && !isTerminalInvocationState(part.toolInvocation.state),
  );
}

/** Fills the gaps in a run: before the first token, between tool calls. The status line already announces the state. */
export function ActivityLine() {
  const { busy, transcript } = useChatTranscript();
  if (!busy || hasVisibleActivity(transcript.entries)) return null;

  return (
    <Txt as="p" variant="ui-sm" aria-hidden className="text-icon3 px-1.5 py-1">
      <Shimmer>Thinking</Shimmer>
    </Txt>
  );
}
