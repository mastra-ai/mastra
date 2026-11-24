import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type {
  TracesExplorerCapabilities,
  TracesFilters,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { useTracesHistogramQuery } from '@mastra/playground-ui/domains/traces/hooks/use-traces-histogram-query';
import { memo } from 'react';
import { STUDIO_TRACES_FEATURES } from './features';

type TracesChartProps = { filters: TracesFilters; capabilities: TracesExplorerCapabilities };

/** The traces histogram, with Studio's counts. */
export const TracesChart = memo(function TracesChart({ filters, capabilities }: TracesChartProps) {
  const histogram = useTracesHistogramQuery({ filters, capabilities, features: STUDIO_TRACES_FEATURES });
  return <TracesExplorer.Histogram data={histogram} />;
});
