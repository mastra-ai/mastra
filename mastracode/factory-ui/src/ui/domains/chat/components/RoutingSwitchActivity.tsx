import {
  ACCOUNT_SWITCH_PART_TYPE,
  accountSwitchNoticeText,
  parseAccountSwitchPart,
} from '@mastra/code-sdk/auth/account-rotation-processor';
import {
  MODEL_FALLBACK_PART_TYPE,
  modelFallbackNoticeText,
  parseModelFallbackPart,
} from '@mastra/code-sdk/model-fallback';
import { ActivityItem } from '@mastra/playground-ui/components/ai/activity';
import type { DataMessagePart } from '@mastra/playground-ui/domains/chat/transcript/components/transcript-parts';
import { IconArrowsRepeatRightLeft } from '@mastra/playground-ui/icons/central/IconArrowsRepeatRightLeft';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import type { DataPart } from '@mastra/react/ui';

function routingSwitch(part: DataMessagePart | DataPart): { label: string; title?: string } | null {
  if (part.type === MODEL_FALLBACK_PART_TYPE) {
    const fallback = parseModelFallbackPart(part.data);
    return fallback
      ? {
          label: modelFallbackNoticeText(fallback, formatModelName),
          title: `${fallback.from.label} → ${fallback.to.label}`,
        }
      : null;
  }
  if (part.type === ACCOUNT_SWITCH_PART_TYPE) {
    const accountSwitch = parseAccountSwitchPart(part.data);
    return accountSwitch ? { label: accountSwitchNoticeText(accountSwitch) } : null;
  }
  return null;
}

export function drawsRoutingSwitch(part: DataMessagePart): boolean {
  return routingSwitch(part) !== null;
}

export function RoutingSwitchPart({ part }: { part: DataPart }) {
  const notice = routingSwitch(part);
  if (!notice) return null;
  return (
    <ActivityItem
      appearance="inline"
      icon={<IconArrowsRepeatRightLeft aria-hidden />}
      label={notice.label}
      aria-label={notice.label}
      title={notice.title}
    />
  );
}
