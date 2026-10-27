import type { McpServerTask } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeIndicator, BadgeVariant } from '@mastra/playground-ui/components/Badge';

const STATUS: Record<McpServerTask['status'], { label: string; variant: BadgeVariant; indicator?: BadgeIndicator }> = {
  working: { label: 'working', variant: 'info', indicator: 'pulse' },
  input_required: { label: 'input required', variant: 'warning', indicator: 'dot' },
  completed: { label: 'completed', variant: 'success' },
  failed: { label: 'failed', variant: 'destructive' },
  cancelled: { label: 'cancelled', variant: 'neutral' },
};

export function McpTaskStatusBadge({ status }: { status: McpServerTask['status'] }) {
  const { label, variant, indicator } = STATUS[status];
  return (
    <Badge size="sm" variant={variant} emphasis="subtle" indicator={indicator}>
      {label}
    </Badge>
  );
}
