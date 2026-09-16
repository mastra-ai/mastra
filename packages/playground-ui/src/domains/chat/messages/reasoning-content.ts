import type { ReasoningPart } from '@mastra/react';
import type { ReasoningProps } from './reasoning';

export function getReasoningContent(part: ReasoningPart): ReasoningProps | undefined {
  const text = 'text' in part && typeof part.text === 'string' ? part.text : part.reasoning;
  const redacted = part.redacted === true;
  const streaming = part.state === 'streaming';
  const hasContent = text.trim().length > 0 || redacted || streaming;

  return hasContent ? { text, redacted, streaming } : undefined;
}
