import { useTraceVolumeMetrics } from '@mastra/react/hooks/metrics';
import { useState } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import type { DrilldownScope } from '../../drilldown';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { OpenErrorsInLogsButton, OpenInTracesButton } from '../card-action-buttons';
import { MetricsTableSkeleton } from '../metrics-table-skeleton';
import { TracesVolumeCardContent } from './traces-volume-card-content';
import { TracesVolumeCardLayout } from './traces-volume-card-layout';
import {
  totalVolume,
  volumeErrorSegmentScope,
  volumeErrorsScope,
  volumeRowScope,
  volumeTracesScope,
} from './traces-volume-card.utils';
import type { VolumeTab } from './traces-volume-card.utils';
import { formatCompactNumber } from '@/lib/cost';

export interface TracesVolumeCardProps {
  onOpenTraces?: (scope: DrilldownScope) => void;
  onOpenErrorsInLogs?: (scope: DrilldownScope) => void;
  onRowClick?: (scope: DrilldownScope) => void;
  onErrorSegmentClick?: (scope: DrilldownScope) => void;
}

export function TracesVolumeCard({
  onOpenTraces,
  onOpenErrorsInLogs,
  onRowClick,
  onErrorSegmentClick,
}: TracesVolumeCardProps) {
  const { data, isLoading, isError } = useTraceVolumeMetrics(useMetricsFilters());
  const [activeTab, setActiveTab] = useState<VolumeTab>('agents');

  if (isLoading) {
    return (
      <TracesVolumeCardLayout>
        <MetricsTableSkeleton label="Loading trace volume" />
      </TracesVolumeCardLayout>
    );
  }

  if (isError || !data) {
    return (
      <TracesVolumeCardLayout>
        <MetricsCard.Error message="Failed to load trace volume data" />
      </TracesVolumeCardLayout>
    );
  }

  const total = totalVolume(data);
  const hasData = total > 0;
  const actions = hasData ? (
    <>
      {onOpenTraces && <OpenInTracesButton onClick={() => onOpenTraces(volumeTracesScope(activeTab))} />}
      {onOpenErrorsInLogs && (
        <OpenErrorsInLogsButton onClick={() => onOpenErrorsInLogs(volumeErrorsScope(activeTab))} />
      )}
    </>
  ) : undefined;

  return (
    <TracesVolumeCardLayout
      summary={hasData ? <MetricsCard.Summary value={formatCompactNumber(total)} label="Total runs" /> : undefined}
      actions={onOpenTraces || onOpenErrorsInLogs ? actions : undefined}
    >
      <TracesVolumeCardContent
        data={data}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRowClick={onRowClick ? (tab, row) => onRowClick(volumeRowScope(tab, row)) : undefined}
        onErrorSegmentClick={
          onErrorSegmentClick ? (tab, row) => onErrorSegmentClick(volumeErrorSegmentScope(tab, row)) : undefined
        }
      />
    </TracesVolumeCardLayout>
  );
}
