import { Sankey, SankeyChart } from '@mastra/playground-ui/components/SankeyChart';
import { SignalsOverviewPage as SignalsEmptyState } from '@mastra/playground-ui/ee/signals';

import { useThemeFlow, useThemeSnapshots } from './hooks';
import { themeFlowToSankeyData } from './sankey-signals-data';
import { SignalsLoadingSkeleton } from './signals-loading-skeleton';
import type { TraceSignalName } from './types';

export interface SankeySignalsProps {
  entityId: string;
  entityType?: string;
  signalNames: TraceSignalName[];
  height?: number;
}

export function SankeySignals({ entityId, entityType = 'agent', signalNames, height }: SankeySignalsProps) {
  const snapshotsQuery = useThemeSnapshots(entityId, entityType, signalNames);
  const snapshot = snapshotsQuery.data?.snapshots[0];
  const flowQuery = useThemeFlow(entityId, entityType, signalNames, snapshot?.snapshotId);

  if (snapshotsQuery.isPending || (snapshot !== undefined && flowQuery.isPending)) {
    return <SignalsLoadingSkeleton />;
  }

  if (snapshotsQuery.isError || flowQuery.isError) {
    return <p>Unable to load signal flow.</p>;
  }

  if (!snapshot) {
    return <SignalsEmptyState />;
  }

  const flow = flowQuery.data;
  const populatedStageCount = flow?.stages.filter(stage => stage.nodes.length > 0).length ?? 0;

  if (!flow || populatedStageCount < 2) {
    return <SignalsEmptyState />;
  }

  const { columns, records } = themeFlowToSankeyData(flow);

  return (
    <section aria-label="Signal theme flow">
      <Sankey data={records} columns={columns}>
        <SankeyChart height={height} />
      </Sankey>
    </section>
  );
}
