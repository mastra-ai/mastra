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
    <section aria-label="Signal theme flow" className="flex min-h-full min-w-0 flex-col gap-6 p-6">
      <header>
        <h1 className="text-header-xl font-medium tracking-tight text-neutral6">
          Understand what drives every agent interaction
        </h1>
      </header>

      <Sankey data={records} columns={columns}>
        <div className="min-h-0 min-w-0 flex-1 w-full">
          <SankeyChart height={height ?? 640} margin={{ top: 40, right: 0, bottom: 12, left: 0 }} />
        </div>
      </Sankey>
    </section>
  );
}
