import type { ReasoningPart } from '@mastra/react';

import { Reasoning } from '../reasoning';
import { ReasoningStreamingLine } from '../reasoning-streaming-line';

export interface ReasoningPartRendererProps {
  part: ReasoningPart;
}

/**
 * Renders a `MessageFactory` `Reasoning` slot. Reasoning parts may carry the
 * text under `text` (streamed) or `reasoning` (persisted), so read whichever is
 * present before handing it to the plain `Reasoning` primitive.
 *
 * While a reasoning part is still streaming but has not produced any text yet
 * (e.g. a `reasoning-start` chunk with `reasoning: ''` and `state: 'streaming'`),
 * show a shimmering "Reasoning..." line so the user sees the model is thinking.
 * Once text arrives it switches to the collapsible panel. An empty, non-streaming
 * reasoning part renders nothing, so it does not leave a dangling "Hide reasoning"
 * toggle over an empty box.
 */
export const ReasoningPartRenderer = ({ part }: ReasoningPartRendererProps) => {
  const reasoningText =
    'text' in part && typeof part.text === 'string'
      ? part.text
      : 'reasoning' in part && typeof part.reasoning === 'string'
        ? part.reasoning
        : '';

  const redacted = 'redacted' in part && part.redacted === true;
  const isStreaming = 'state' in part && part.state === 'streaming';

  if (!reasoningText && !redacted && isStreaming) {
    return <ReasoningStreamingLine text="Reasoning..." />;
  }

  return <Reasoning text={reasoningText} redacted={redacted} />;
};
