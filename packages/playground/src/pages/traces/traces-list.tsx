import { TracesExplorer, useTraceUsageColumns } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { TracesExplorerTraces } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { useTracesUsageQuery } from '@mastra/playground-ui/domains/traces/hooks/use-traces-usage-query';
import { memo } from 'react';

type TracesListProps = { rows: TracesExplorerTraces['rows'] };

/** The traces list, with Studio's token and cost usage for its rows. */
export const TracesList = memo(function TracesList({ rows }: TracesListProps) {
  // Loaded only while a usage column shows and the store reports metrics.
  const { usageEnabled } = useTraceUsageColumns();
  const usage = useTracesUsageQuery({ traceIds: rows.map(row => row.traceId), enabled: usageEnabled });
  return <TracesExplorer.List usage={usage} />;
});
