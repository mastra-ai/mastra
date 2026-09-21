import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { TraceIntelligenceEntityDetail, TraceIntelligenceProvider } from '@mastra/playground-ui/ee/signals';
import { useParams } from 'react-router';
import { Link } from '../../lib/link';
import { SignalsEntityCrumb } from './signals-entity-crumb';
import { useSignalsDateUrlState } from './use-signals-date-url-state';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb, type CrumbDef } from '@/domains/navigation/crumbs';

const crumbs: CrumbDef[] = [navCrumb('/intelligence'), { id: 'signals-entity', Component: SignalsEntityCrumb }];

export function SignalsEntityDetailPage() {
  const { entityType, entityId } = useParams();
  const url = useSignalsDateUrlState();

  if (!entityType || !entityId) return null;

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="grid grid-rows-[minmax(0,1fr)]">
      <TraceIntelligenceProvider cacheScope="oss-studio" LinkComponent={Link}>
        <TraceIntelligenceEntityDetail
          entityId={entityId}
          entityType={entityType}
          dateFrom={url.selectedDateFrom}
          dateTo={url.selectedDateTo}
          dateRangePicker={
            <DateTimeRangePicker
              preset={url.datePreset}
              onPresetChange={url.handleDatePresetChange}
              dateFrom={url.selectedDateFrom}
              dateTo={url.selectedDateTo}
              onDateChange={url.handleDateChange}
              presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
              size="sm"
            />
          }
        />
      </TraceIntelligenceProvider>
    </PageLayout>
  );
}

export default SignalsEntityDetailPage;
