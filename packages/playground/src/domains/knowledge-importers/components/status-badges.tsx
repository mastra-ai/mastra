import type { KnowledgeImporterRunSummary } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';

const RUN_STATUS: Record<KnowledgeImporterRunSummary['status'], { label: string; variant: BadgeVariant }> = {
  queued: { label: 'Queued', variant: 'info' },
  running: { label: 'Running', variant: 'info' },
  succeeded: { label: 'Succeeded', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
};

export function RunStatusBadge({ status }: { status: KnowledgeImporterRunSummary['status'] }) {
  const { label, variant } = RUN_STATUS[status];
  return (
    <Badge variant={variant} emphasis="subtle" size="sm">
      {label}
    </Badge>
  );
}
