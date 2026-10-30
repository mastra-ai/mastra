import type { KnowledgeImporterPreviewDestination } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { describePlacement } from '../runs';

/** Where the sink put these pages — never a claim about who can read them. */
export function PlacementBadge({ destination }: { destination: KnowledgeImporterPreviewDestination }) {
  return (
    <Badge variant={destination.placement === 'org-wide' ? 'info' : 'neutral'} emphasis="subtle" size="sm">
      {describePlacement(destination)}
    </Badge>
  );
}
