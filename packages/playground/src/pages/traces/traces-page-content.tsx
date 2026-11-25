import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type {
  TracesExplorerCapabilities,
  TracesExplorerTraces,
  TracesFilters,
  TracesMetricsSupport,
  TracesSelection,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { TraceColumnPreferences } from '@mastra/playground-ui/domains/traces/trace-list-columns';
import { memo } from 'react';
import { TracesChart } from './traces-chart';
import { TracesList } from './traces-list';
import { TracesPanel } from './traces-panel';
import { TracesToolbar } from './traces-toolbar';

type TracesPageContentProps = {
  isScoped: boolean;
  selection: TracesSelection;
  filters: TracesFilters;
  capabilities: TracesExplorerCapabilities;
  columns: TraceColumnPreferences;
  metricsSupport: TracesMetricsSupport;
  traces: Pick<TracesExplorerTraces, 'rows' | 'isLoading'>;
};

// Memoized so a list refresh (a poll tick) re-renders only the explorer parts whose context slice changed,
// not the whole tree. Each Studio part below loads its own records once the body shows it.
export const TracesPageContent = memo(function TracesPageContent({
  isScoped,
  selection,
  filters,
  capabilities,
  columns,
  metricsSupport,
  traces,
}: TracesPageContentProps) {
  const toolbar = <TracesToolbar filters={filters} capabilities={capabilities} />;
  const chart = <TracesChart filters={filters} capabilities={capabilities} />;
  const content = (
    <>
      <TracesList rows={traces.rows} />
      <TracesPanel
        selection={selection}
        traces={traces}
        capabilities={capabilities}
        columns={columns}
        metricsSupport={metricsSupport}
      />
    </>
  );

  // Scoped instances render inside another page (e.g. the agent Traces tab) whose header has no
  // breadcrumbs or view switch; /traces gets both from the shared observability layout.
  if (isScoped)
    return (
      <TracesExplorer.Layout toolbar={toolbar} chart={chart}>
        {content}
      </TracesExplorer.Layout>
    );

  return (
    <TracesExplorer.Body toolbar={toolbar} chart={chart}>
      {content}
    </TracesExplorer.Body>
  );
});
