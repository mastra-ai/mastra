import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';

import { Link } from '../../lib/link';
import { useEntityLearningProgress } from './hooks';
import { SankeySignals } from './sankey-signals';
import { SIGNAL_PROCESSING_ORDER } from './signal-formatting';
import { SignalsErrorState } from './signals-error-state';
import { SignalsLoadingSkeleton } from './signals-loading-skeleton';
import { useSelectedThemeEntity } from './use-selected-theme-entity';
import { useSignalsDateUrlState } from './use-signals-date-url-state';

export function SignalsOverviewPage() {
  const { entitiesQuery, entity } = useSelectedThemeEntity();
  const url = useSignalsDateUrlState();
  const signalNames = entity
    ? SIGNAL_PROCESSING_ORDER.filter(signalName => entity.availableSignals.includes(signalName))
    : [];
  const progressQuery = useEntityLearningProgress(
    entity?.entityId,
    entity?.entityType ?? 'agent',
    !entitiesQuery.isPending && !entitiesQuery.isError && signalNames.length < 2,
  );

  if (entitiesQuery.isPending) {
    return <SignalsLoadingSkeleton />;
  }

  if (entitiesQuery.isError) {
    return (
      <SignalsErrorState message="Unable to load trace signal entities." onRetry={() => void entitiesQuery.refetch()} />
    );
  }

  if (!entity) {
    return <SignalsEmptyState LinkComponent={Link} />;
  }

  if (signalNames.length < 2) {
    return <SignalsEmptyState LinkComponent={Link} progress={progressQuery.data} />;
  }

  return (
    <SankeySignals
      key={`${entity.entityId}:${signalNames.join(',')}:${url.selectedDateFrom?.toISOString() ?? 'open'}:${url.selectedDateTo?.toISOString() ?? 'open'}`}
      entityId={entity.entityId}
      entityType="agent"
      signalNames={signalNames}
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
  );
}
