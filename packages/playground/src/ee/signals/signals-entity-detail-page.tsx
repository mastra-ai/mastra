import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { TraceIntelligenceEntityDetail, TraceIntelligenceProvider } from '@mastra/playground-ui/ee/signals';
import { useParams } from 'react-router';

import { Link } from '../../lib/link';
import { useSignalsDateUrlState } from './use-signals-date-url-state';

export function SignalsEntityDetailPage() {
  const { entityType, entityId } = useParams();
  const url = useSignalsDateUrlState();

  if (!entityType || !entityId) return null;

  return (
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
  );
}

export default SignalsEntityDetailPage;
