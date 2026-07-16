import { Sankey, SankeyChart } from '@mastra/playground-ui/components/SankeyChart';

import { useThemeFlow, useThemeSnapshots } from './hooks';
import { themeFlowToSankeyData } from './sankey-signals-data';
import type { TraceSignalName } from './types';

export interface SankeySignalsProps {
  entityId: string;
  entityType?: string;
  signalNames: TraceSignalName[];
  height?: number;
}

export function SankeySignals({ entityId, entityType = 'agent', signalNames, height }: SankeySignalsProps) {
  const snapshots = useThemeSnapshots(entityId, entityType, signalNames);
  const snapshotId = snapshots.data?.snapshots[0]?.snapshotId;
  const flow = useThemeFlow(entityId, entityType, signalNames, snapshotId);

  if (snapshots.isPending || (snapshotId && flow.isPending)) return <p>Loading signal flow…</p>;
  if (snapshots.isError || flow.isError) return <p>Unable to load signal flow.</p>;
  if (!snapshotId || !flow.data) return <p>No signal flow is available for this entity.</p>;

  const { columns, records } = themeFlowToSankeyData(flow.data);

  return (
    <section aria-label="Signal theme flow">
      <Sankey columns={columns} data={records}>
        <SankeyChart height={height} />
      </Sankey>
    </section>
  );
}
