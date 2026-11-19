import { useTraceUsage } from '@mastra/react/hooks/traces';
import type { TracesExplorerUsage } from '../components/traces-explorer/traces-explorer-data';

export type UseTracesUsageQueryArgs = {
  /** The traces whose usage to load, e.g. the listed rows. */
  traceIds: readonly string[];
  /** A usage column shows and the store reports metrics (`resolveTraceUsageColumns(…).usageEnabled`). */
  enabled: boolean;
  /** Refreshes with the list's polling. Defaults to `true`, like the traces list. */
  autoRefetch?: boolean;
};

/**
 * Studio's token and estimated-cost totals by trace, through the Mastra client (`getMetricBreakdown`).
 * Pass the result as `TracesExplorer.List`'s `usage`.
 */
export function useTracesUsageQuery({
  traceIds,
  enabled,
  autoRefetch = true,
}: UseTracesUsageQueryArgs): TracesExplorerUsage | undefined {
  const { data } = useTraceUsage({ traceIds, enabled, autoRefetch });
  return data;
}
