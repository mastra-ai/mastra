import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import type { DateRangePreset } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';
import { useState } from 'react';

import { Link } from '../../lib/link';
import { useEntityLearningProgress, useThemeEntities } from './hooks';
import { SankeySignals } from './sankey-signals';
import { SignalsErrorState } from './signals-error-state';
import { SignalsLoadingSkeleton } from './signals-loading-skeleton';
import type { ThemeLearningEntity, TraceSignalName } from './types';

const SIGNAL_ORDER: TraceSignalName[] = ['goal', 'outcome', 'behavior', 'sentiment'];

function SignalsControls({
  entities,
  selectedEntityId,
  onEntityChange,
  showDatePicker,
  datePreset,
  dateFrom,
  dateTo,
  onDatePresetChange,
  onDateChange,
}: {
  entities: ThemeLearningEntity[];
  selectedEntityId: string;
  onEntityChange: (entityId: string) => void;
  showDatePicker: boolean;
  datePreset: DateRangePreset;
  dateFrom?: Date;
  dateTo?: Date;
  onDatePresetChange: (preset: DateRangePreset) => void;
  onDateChange: (value: Date | undefined, type: 'from' | 'to') => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 px-6 pt-6 pb-8 md:px-10 lg:px-12 lg:pt-8 lg:pb-10 xl:px-[4.375rem]">
      <label className="text-neutral4 text-xs font-medium" htmlFor="signals-agent-selector">
        Agent
      </label>
      <Select value={selectedEntityId} onValueChange={onEntityChange}>
        <SelectTrigger className="min-w-0 flex-1 sm:w-64 sm:flex-none" id="signals-agent-selector" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {entities.map(entity => (
            <SelectItem key={entity.entityId} value={entity.entityId}>
              {entity.entityId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showDatePicker ? (
        <>
          <span className="text-neutral4 text-xs font-medium">Snapshot date</span>
          <DateTimeRangePicker
            preset={datePreset}
            onPresetChange={onDatePresetChange}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={onDateChange}
            presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
            size="sm"
          />
        </>
      ) : null}
    </div>
  );
}

export function SignalsOverviewPage() {
  const entitiesQuery = useThemeEntities('agent');
  const [selectedEntityId, setSelectedEntityId] = useState<string>();
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last-7d');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [dateTo, setDateTo] = useState<Date>();
  const handleDateChange = (value: Date | undefined, type: 'from' | 'to') => {
    if (type === 'from') setDateFrom(value);
    else setDateTo(value);
  };
  const entities = entitiesQuery.data?.entities ?? [];
  const entity =
    entities.find(currentEntity => currentEntity.entityId === selectedEntityId) ??
    entities.find(currentEntity => currentEntity.availableSignals.length >= 2) ??
    entities[0];
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

  return (
    <>
      <SignalsControls
        entities={entities}
        selectedEntityId={entity.entityId}
        onEntityChange={setSelectedEntityId}
        showDatePicker={signalNames.length >= 2}
        datePreset={datePreset}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDatePresetChange={setDatePreset}
        onDateChange={handleDateChange}
      />
      {signalNames.length >= 2 ? (
        <SankeySignals
          key={`${entity.entityId}:${signalNames.join(',')}:${dateFrom?.toISOString() ?? 'open'}:${dateTo?.toISOString() ?? 'open'}`}
          entityId={entity.entityId}
          entityType="agent"
          signalNames={signalNames}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      ) : (
        <SignalsEmptyState LinkComponent={Link} progress={progressQuery.data} />
      )}
    </>
  );
}
