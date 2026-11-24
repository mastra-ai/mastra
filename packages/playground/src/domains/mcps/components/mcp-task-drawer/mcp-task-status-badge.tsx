import type { McpServerTask } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeIndicator, BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { TASK_STATUS_LABELS } from '../../hooks/use-mcp-server-tasks';

const STATUS: Record<McpServerTask['status'], { variant: BadgeVariant; indicator?: BadgeIndicator }> = {
  working: { variant: 'info', indicator: 'pulse' },
  input_required: { variant: 'warning', indicator: 'dot' },
  completed: { variant: 'success' },
  failed: { variant: 'destructive' },
  cancelled: { variant: 'neutral' },
};

export function McpTaskStatusBadge({ status }: { status: McpServerTask['status'] }) {
  const { variant, indicator } = STATUS[status];
  return (
    <Badge size="sm" variant={variant} emphasis="subtle" indicator={indicator}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}
