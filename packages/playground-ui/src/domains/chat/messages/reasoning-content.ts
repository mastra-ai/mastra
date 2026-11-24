import type { ReasoningPart } from '@mastra/react/ui';
import { hasVisibleReasoning } from '@/ds/components/ai/activity';
import type { ReasoningContent } from '@/ds/components/ai/activity';

export function getReasoningContent(part: ReasoningPart): ReasoningContent | undefined {
  const content = {
    text: 'text' in part && typeof part.text === 'string' ? part.text : part.reasoning,
    redacted: part.redacted === true,
    streaming: part.state === 'streaming',
  };

  return hasVisibleReasoning(content) ? content : undefined;
}
