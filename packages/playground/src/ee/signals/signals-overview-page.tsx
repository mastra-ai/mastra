import { TraceIntelligenceEntityIndex, TraceIntelligenceProvider } from '@mastra/playground-ui/ee/signals';

import { Link } from '../../lib/link';
import { useEntityIndexUrlState } from './use-entity-index-url-state';

export function SignalsOverviewPage() {
  return (
    <TraceIntelligenceProvider cacheScope="oss-studio" LinkComponent={Link}>
      <SignalsOverviewContent />
    </TraceIntelligenceProvider>
  );
}

function SignalsOverviewContent() {
  const urlState = useEntityIndexUrlState();
  return (
    <TraceIntelligenceEntityIndex
      entityType="agent"
      {...urlState}
      getEntityHref={entity =>
        `/intelligence/entities/${encodeURIComponent(entity.entityType)}/${encodeURIComponent(entity.entityId)}`
      }
    />
  );
}
