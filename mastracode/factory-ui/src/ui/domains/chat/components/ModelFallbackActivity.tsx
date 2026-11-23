import { modelFallbackNoticeText } from '@mastra/code-sdk/model-fallback';
import type { ModelFallbackPartData } from '@mastra/code-sdk/model-fallback';
import { ActivityItem } from '@mastra/playground-ui/components/ai/activity';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowsRepeatRightLeft } from '@mastra/playground-ui/icons/central/IconArrowsRepeatRightLeft';
import { formatModelName } from '@mastra/playground-ui/utils/model';

export function ModelFallbackActivity({ fallback }: { fallback: ModelFallbackPartData }) {
  const label = modelFallbackNoticeText(fallback, formatModelName);
  return (
    <ActivityItem
      appearance="inline"
      icon={<IconArrowsRepeatRightLeft aria-hidden />}
      label={label}
      aria-label={label}
      title={`${fallback.from.label} → ${fallback.to.label}`}
    >
      <Txt as="p" variant="caption" tone="muted">
        Your next message starts on the session model again.
      </Txt>
    </ActivityItem>
  );
}
