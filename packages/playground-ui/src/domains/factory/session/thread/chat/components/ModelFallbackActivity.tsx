import { MODEL_FALLBACK_PART_TYPE, modelFallbackNoticeText, parseModelFallbackPart } from '@mastra/core/llm/reasoning';
import type { ModelFallbackPartData } from '@mastra/core/llm/reasoning';
import type { DataPart } from '@mastra/react/ui';
import { ActivityItem } from '@/ds/components/ai/activity';
import { IconArrowsRepeatRightLeft } from '@/ds/icons/central/IconArrowsRepeatRightLeft';
import { formatModelName } from '@/utils/model';

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

export function ModelFallbackPart({ part }: { part: DataPart }) {
  const fallback = part.type === MODEL_FALLBACK_PART_TYPE ? parseModelFallbackPart(part.data) : null;
  return fallback ? <ModelFallbackActivity fallback={fallback} /> : null;
}
