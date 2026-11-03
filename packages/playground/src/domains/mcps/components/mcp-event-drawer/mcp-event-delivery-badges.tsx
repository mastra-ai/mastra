import type { McpServerEventInfo } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';

const DELIVERY_VARIANTS = { push: 'blue', poll: 'neutral', webhook: 'purple' } as const;

export function McpEventDeliveryBadges({ delivery }: { delivery: McpServerEventInfo['delivery'] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {delivery.map(mode => (
        <Badge key={mode} size="xs" variant={DELIVERY_VARIANTS[mode]} emphasis="subtle">
          {mode}
        </Badge>
      ))}
    </span>
  );
}
