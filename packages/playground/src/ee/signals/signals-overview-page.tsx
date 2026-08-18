import { TraceIntelligenceEntityIndex, TraceIntelligenceProvider } from '@mastra/playground-ui/ee/signals';
import { useSearchParams } from 'react-router';

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
  const [searchParams] = useSearchParams();

  return (
    <TraceIntelligenceEntityIndex
      entityType="agent"
      {...urlState}
      getEntityHref={entity => {
        const detailSearch = new URLSearchParams();
        for (const key of ['datePreset', 'dateFrom', 'dateTo']) {
          const value = searchParams.get(key);
          if (value) detailSearch.set(key, value);
        }
        const query = detailSearch.toString();
        return `/intelligence/entities/${encodeURIComponent(entity.entityType)}/${encodeURIComponent(entity.entityId)}${query ? `?${query}` : ''}`;
      }}
    />
  );
}
