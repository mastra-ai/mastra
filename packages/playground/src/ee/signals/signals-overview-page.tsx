import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { TraceIntelligenceEntityIndex, TraceIntelligenceProvider } from '@mastra/playground-ui/ee/signals';
import { Navigate, useSearchParams } from 'react-router';
import { Link } from '../../lib/link';
import { useEntityIndexUrlState } from './use-entity-index-url-state';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/intelligence')];

export function SignalsOverviewPage() {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="grid grid-rows-[minmax(0,1fr)]">
      <TraceIntelligenceProvider cacheScope="oss-studio" LinkComponent={Link}>
        <SignalsOverviewContent />
      </TraceIntelligenceProvider>
    </PageLayout>
  );
}

function SignalsOverviewContent() {
  const urlState = useEntityIndexUrlState();
  const [searchParams] = useSearchParams();
  const legacyEntityId = searchParams.get('agent');

  if (legacyEntityId) {
    const detailSearch = new URLSearchParams(searchParams);
    detailSearch.delete('agent');
    const query = detailSearch.toString();
    return (
      <Navigate
        replace
        to={`/intelligence/entities/agent/${encodeURIComponent(legacyEntityId)}${query ? `?${query}` : ''}`}
      />
    );
  }

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
