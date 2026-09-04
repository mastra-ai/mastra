import type { MastraMessagePart } from '@mastra/core/agent-controller';
import { Shimmer } from '@mastra/playground-ui/components/Shimmer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useEffect, useState } from 'react';

import { useChatTranscript } from '../context/useChatTranscript';
import { isTerminalInvocationState } from '../services/transcript';
import type { TimelineEntry } from '../services/transcript';
import { Arriving } from '@mastra/playground-ui/components/Arrival';
import { isTranscriptToolVisible } from './ToolFactory';

/**
 * Parts the transcript puts on screen. A hidden tool draws nothing, and an `ask_user` is drawn
 * by its suspension prompt — until that prompt lands, its row renders nothing at all.
 */
function partIsDrawn(part: MastraMessagePart): boolean {
  switch (part.type) {
    case 'text':
      return part.text.trim().length > 0;
    case 'reasoning':
      return part.reasoning.trim().length > 0;
    case 'file':
      return true;
    case 'tool-invocation': {
      const { toolName, state } = part.toolInvocation;
      if (!isTranscriptToolVisible(toolName)) return false;
      return toolName !== 'ask_user' || isTerminalInvocationState(state);
    }
    default:
      return false;
  }
}

/**
 * Output the run produced itself. Every non-message entry — notice, approval, suspension,
 * notification, subagent — draws its own card, so only a message can be silent.
 */
function isRunOutput(entry: TimelineEntry): boolean {
  if (entry.kind !== 'message') return true;
  if (entry.message.role !== 'assistant') return false;
  return entry.message.content.parts.some(partIsDrawn);
}

/**
 * Nothing the run produced has reached the screen yet. A suspension prompt lands after the
 * message holding its call, so walking back stops on the prompt before reaching the silent row.
 */
function awaitingFirstOutput(entries: TimelineEntry[]): boolean {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry.kind === 'message' && entry.message.role === 'user') return true;
    if (isRunOutput(entry)) return false;
  }
  return true;
}

/** Long enough for the sweep to settle and the line to fade before it leaves the tree. */
const LINGER_MS = 500;

/** True while `on`, and for a moment after it turns off — the room an exit needs to play. */
function useLinger(on: boolean): boolean {
  const [linger, setLinger] = useState(false);
  if (on && !linger) setLinger(true);

  useEffect(() => {
    if (on || !linger) return;
    const timer = setTimeout(() => setLinger(false), LINGER_MS);
    return () => clearTimeout(timer);
  }, [on, linger]);

  return on || linger;
}

/**
 * Covers the silence between sending and the run's first visible output. Everything after that
 * says its own state: a running tool sweeps its label, text arrives as it streams, and the
 * composer ring carries the rest. It leaves the way the rest of the transcript moves: the
 * sweep settles and the line fades under the output replacing it, instead of vanishing mid-sweep.
 */
export function ActivityLine() {
  const { busy, transcript } = useChatTranscript();
  const thinking = busy && awaitingFirstOutput(transcript.entries);
  const shown = useLinger(thinking);
  if (!shown) return null;

  return (
    <Arriving>
      <Txt
        as="p"
        variant="ui-sm"
        aria-hidden
        className={cn('text-icon3 px-1.5 py-1 transition-opacity duration-300', !thinking && 'opacity-0')}
      >
        <Shimmer active={thinking}>Thinking</Shimmer>
      </Txt>
    </Arriving>
  );
}
