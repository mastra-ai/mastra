import { MODEL_FALLBACK_PART_TYPE, parseModelFallbackPart } from '@mastra/core/llm/reasoning';

import type { DataMessagePart } from '@/domains/chat/transcript/components/transcript-parts';

export function drawsModelFallback(part: DataMessagePart): boolean {
  return part.type === MODEL_FALLBACK_PART_TYPE && parseModelFallbackPart(part.data) !== null;
}
