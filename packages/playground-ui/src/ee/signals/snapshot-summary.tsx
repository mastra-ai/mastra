import { snapshotSummaryParts } from './sankey-signals-data';
import type { ThemeFlowResponse, ThemeSnapshot } from './types';
import { Metadata } from '@/ds/components/Metadata';

export function SnapshotSummary({
  snapshot,
  flow,
  prefix,
  label,
}: {
  snapshot: ThemeSnapshot;
  flow: ThemeFlowResponse | undefined;
  prefix?: string;
  label?: string;
}) {
  return (
    <Metadata role={label ? 'group' : undefined} aria-label={label}>
      {prefix && <Metadata.Item>{prefix}</Metadata.Item>}
      {snapshotSummaryParts(snapshot, flow).map(part => (
        <Metadata.Item key={part}>{part}</Metadata.Item>
      ))}
    </Metadata>
  );
}
