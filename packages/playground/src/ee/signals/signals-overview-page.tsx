import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import type { DateRangePreset } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';
import { useState } from 'react';

import { Link } from '../../lib/link';
import { SankeySignals } from './sankey-signals';
import { SignalsErrorState } from './signals-error-state';
import { SignalsLoadingSkeleton } from './signals-loading-skeleton';
import type { TraceSignalName } from './types';
import { useSelectedThemeEntity } from './use-selected-theme-entity';

const SIGNAL_ORDER: TraceSignalName[] = ['goal', 'outcome', 'behavior', 'sentiment'];

function formatSignalName(signalName: TraceSignalName) {
  return signalName.charAt(0).toUpperCase() + signalName.slice(1);
}

export function SignalsOverviewPage() {
  const { entitiesQuery, entity } = useSelectedThemeEntity();
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last-7d');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [dateTo, setDateTo] = useState<Date>();
  const handleDateChange = (value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') setDateFrom(value);
    else setDateTo(value);
  };

  if (entitiesQuery.isPending) {
    return <SignalsLoadingSkeleton />;
  }

  if (entitiesQuery.isError) {
    return (
      <SignalsErrorState
        message="Unable to load trace intelligence entities."
        onRetry={() => void entitiesQuery.refetch()}
      />
    );
  }

  if (!entity) {
    return <SignalsEmptyState LinkComponent={Link} />;
  }

  const signalNames = SIGNAL_ORDER.filter(signalName => entity.availableSignals.includes(signalName));

  if (signalNames.length < 2) {
    return (
      <section
        className="border-border1 bg-surface2 m-4 rounded-lg border p-6 lg:m-6"
        aria-labelledby="signals-data-heading"
      >
        <h1 className="text-neutral6 text-lg font-semibold" id="signals-data-heading">
          Not enough trace signal data yet
        </h1>
        <p className="text-neutral3 mt-2 text-sm">
          At least two trace signal types are needed to show how themes connect across traces.
        </p>
        <p className="text-neutral4 mt-4 text-xs">
          Available trace signals: {signalNames.length > 0 ? signalNames.map(formatSignalName).join(', ') : 'None'}
        </p>
      </section>
    );
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
