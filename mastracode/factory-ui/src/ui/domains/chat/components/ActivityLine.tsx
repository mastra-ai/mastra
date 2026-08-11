import { Shimmer } from '@mastra/playground-ui/components/Shimmer';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useChatTranscript } from '../context/useChatTranscript';
import type { TimelineEntry } from '../services/transcript';

/** The run has yet to put anything of its own on screen: nothing at all, or only the message that started it. */
function awaitingFirstOutput(entries: TimelineEntry[]): boolean {
  const last = entries.at(-1);
  if (!last) return true;
  return last.kind === 'message' && last.message.role === 'user';
}

/**
 * Covers the silence between sending and the run's first output. Everything after that says its own state:
 * a running tool sweeps its label, text arrives as it streams, and the composer ring carries the rest.
 */
export function ActivityLine() {
  const { busy, transcript } = useChatTranscript();
  if (!busy || !awaitingFirstOutput(transcript.entries)) return null;

  return (
    <Txt as="p" variant="ui-sm" aria-hidden className="text-icon3 px-1.5 py-1">
      <Shimmer>Thinking</Shimmer>
    </Txt>
  );
}
