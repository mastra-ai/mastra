import {
  MODEL_FALLBACK_PART_TYPE,
  modelFallbackNoticeText,
  parseModelFallbackPart,
} from '@mastra/code-sdk/model-fallback';
import type { ModelFallbackPartData } from '@mastra/code-sdk/model-fallback';
import { ActivityItem } from '@mastra/playground-ui/components/ai/activity';
import type { DataMessagePart } from '@mastra/playground-ui/domains/chat/transcript/components/transcript-parts';
import { IconArrowsRepeatRightLeft } from '@mastra/playground-ui/icons/central/IconArrowsRepeatRightLeft';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import type { DataPart } from '@mastra/react/ui';

export function ModelFallbackActivity({ fallback }: { fallback: ModelFallbackPartData }) {
  const label = modelFallbackNoticeText(fallback, formatModelName);
  return (
    <ActivityItem
      appearance="inline"
      icon={<IconArrowsRepeatRightLeft aria-hidden />}
      label={label}
      aria-label={label}
      title={`${fallback.from.label} → ${fallback.to.label}`}
    />
  );
}

export function drawsModelFallback(part: DataMessagePart): boolean {
  return part.type === MODEL_FALLBACK_PART_TYPE && parseModelFallbackPart(part.data) !== null;
}

export function ModelFallbackPart({ part }: { part: DataPart }) {
  const fallback = part.type === MODEL_FALLBACK_PART_TYPE ? parseModelFallbackPart(part.data) : null;
  return fallback ? <ModelFallbackActivity fallback={fallback} /> : null;
}
