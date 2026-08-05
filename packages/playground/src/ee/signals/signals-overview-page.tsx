import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import type { DateRangePreset } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';
import { useState } from 'react';

import { Link } from '../../lib/link';
import { useEntityLearningProgress } from './hooks';
import { SankeySignals } from './sankey-signals';
import { SignalsErrorState } from './signals-error-state';
import { SignalsLoadingSkeleton } from './signals-loading-skeleton';
import type { TraceSignalName } from './types';
import { useSelectedThemeEntity } from './use-selected-theme-entity';

const SIGNAL_ORDER: TraceSignalName[] = ['goal', 'outcome', 'behavior', 'sentiment'];

export function SignalsOverviewPage() {
  const { entitiesQuery, entity } = useSelectedThemeEntity();
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last-7d');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [dateTo, setDateTo] = useState<Date>();
  const handleDateChange = (value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') setDateFrom(value);
    else setDateTo(value);
  };
  const signalNames = entity ? SIGNAL_ORDER.filter(signalName => entity.availableSignals.includes(signalName)) : [];
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
      key={`${entity.entityId}:${signalNames.join(',')}:${dateFrom?.toISOString() ?? 'open'}:${dateTo?.toISOString() ?? 'open'}`}
      entityId={entity.entityId}
      entityType="agent"
      signalNames={signalNames}
      dateFrom={dateFrom}
      dateTo={dateTo}
      dateRangePicker={
        <DateTimeRangePicker
          preset={datePreset}
          onPresetChange={setDatePreset}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={handleDateChange}
          presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
          size="sm"
        />
      }
    />
  );
}
