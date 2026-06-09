import type { ReasoningPart } from '@mastra/react';

import { Reasoning } from '../reasoning';

export interface ReasoningPartRendererProps {
  part: ReasoningPart;
}

/**
 * Renders a `MessageFactory` `Reasoning` slot. Reasoning parts may carry the
 * text under `text` (streamed) or `reasoning` (persisted), so read whichever is
 * present before handing it to the plain `Reasoning` primitive.
 */
export const ReasoningPartRenderer = ({ part }: ReasoningPartRendererProps) => {
  const reasoningText =
    'text' in part && typeof part.text === 'string'
      ? part.text
      : 'reasoning' in part && typeof part.reasoning === 'string'
        ? part.reasoning
        : '';

  return <Reasoning text={reasoningText} />;
};
