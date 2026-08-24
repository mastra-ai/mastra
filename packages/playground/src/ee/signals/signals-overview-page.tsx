import { DateTimeRangePicker } from '@mastra/playground-ui/components/DateTimeRangePicker';
import {
  SankeySignals,
  SignalsErrorState,
  SignalsLoadingSkeleton,
  SignalsOverviewPage as SignalsEmptyState,
  SIGNAL_PROCESSING_ORDER,
  TraceIntelligenceProvider,
  useEntityLearningProgress,
  useThemeSnapshots,
} from '@mastra/playground-ui/ee/signals';
import { useState } from 'react';

import { Link } from '../../lib/link';
import { useSelectedThemeEntity } from './use-selected-theme-entity';
import { useSignalsDateUrlState } from './use-signals-date-url-state';

export function SignalsOverviewPage() {
  return (
    <TraceIntelligenceProvider cacheScope="oss-studio" LinkComponent={Link}>
      <SignalsOverviewContent />
    </TraceIntelligenceProvider>
  );
}

function SignalsOverviewContent() {
  const { entitiesQuery, entity } = useSelectedThemeEntity();
  const url = useSignalsDateUrlState();
  const [selectedThemeId, setSelectedThemeId] = useState<string>();
  const [selectedFrameId, setSelectedFrameId] = useState<string>();
  const signalNames = entity
    ? SIGNAL_PROCESSING_ORDER.filter(signalName => entity.availableSignals.includes(signalName))
    : [];
  const progressQuery = useEntityLearningProgress(
    entity?.entityId,
    entity?.entityType ?? 'agent',
    !entitiesQuery.isPending && !entitiesQuery.isError && signalNames.length < 2,
  );
  // Same query key as inside SankeySignals, so react-query dedupes the fetch.
  const snapshotsQuery = useThemeSnapshots(
    entity?.entityId ?? '',
    'agent',
    signalNames,
    url.selectedDateFrom,
    url.selectedDateTo,
  );
  const snapshots = snapshotsQuery.data?.snapshots ?? [];
  const firstSnapshotId = [...snapshots].sort((left, right) => left.ordinal - right.ordinal)[0]?.snapshotId;
  // Pure derivation: the parent owns the frame; fall back to the first frame only
  // until a selection exists. SankeySignals handles transient mismatches itself.
  const frameId = selectedFrameId ?? firstSnapshotId;

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

  const dateRangePicker = (
    <DateTimeRangePicker
      preset={url.datePreset}
      onPresetChange={url.handleDatePresetChange}
      dateFrom={url.selectedDateFrom}
      dateTo={url.selectedDateTo}
      onDateChange={url.handleDateChange}
      presets={['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom']}
      size="sm"
    />
  );
  const pickerRow = <div className="flex justify-end px-4 pt-4 lg:px-6 lg:pt-6">{dateRangePicker}</div>;

  if (snapshotsQuery.isPending) {
    return (
      <>
        {pickerRow}
        <SignalsLoadingSkeleton />
      </>
    );
  }

  if (snapshotsQuery.isError) {
    return (
      <>
        {pickerRow}
        <SignalsErrorState message="Unable to load trace signal flow." onRetry={() => void snapshotsQuery.refetch()} />
      </>
    );
  }

  if (!frameId) {
    return (
      <>
        {pickerRow}
        <SignalsEmptyState LinkComponent={Link} isRangeEmpty />
      </>
    );
  }

  return (
    <SankeySignals
      key={`${entity.entityId}:${signalNames.join(',')}:${url.selectedDateFrom?.toISOString() ?? 'open'}:${url.selectedDateTo?.toISOString() ?? 'open'}`}
      entityId={entity.entityId}
      entityType="agent"
      signalNames={signalNames}
      dateFrom={url.selectedDateFrom}
      dateTo={url.selectedDateTo}
      selectedThemeId={selectedThemeId}
      onSelectedThemeIdChange={setSelectedThemeId}
      selectedFrameId={frameId}
      onFrameIdChange={setSelectedFrameId}
      dateRangePicker={dateRangePicker}
    />
  );
}
