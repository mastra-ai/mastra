import { TracesExplorerAutoRefresh } from './traces-explorer-auto-refresh';
import { TracesExplorerColumnsMenu } from './traces-explorer-columns-menu';
import {
  TracesExplorerFilterBar,
  TracesExplorerFilterChips,
  TracesExplorerTimeRangeChip,
} from './traces-explorer-filter-bar';
import { TracesExplorerLayout } from './traces-explorer-layout';
import { TracesExplorerList } from './traces-explorer-list';
import { TracesExplorerPanel } from './traces-explorer-panel';
import { TracesExplorerRoot } from './traces-explorer-root';

export const TracesExplorer = Object.assign(TracesExplorerRoot, {
  Layout: TracesExplorerLayout,
  FilterBar: TracesExplorerFilterBar,
  FilterChips: TracesExplorerFilterChips,
  TimeRangeChip: TracesExplorerTimeRangeChip,
  ColumnsMenu: TracesExplorerColumnsMenu,
  AutoRefresh: TracesExplorerAutoRefresh,
  List: TracesExplorerList,
  Panel: TracesExplorerPanel,
});

export type { TracesExplorerRootProps } from './traces-explorer-root';
export type { TracesExplorerErrorRenderArgs, TracesExplorerLayoutProps } from './traces-explorer-layout';
export type {
  TracesExplorerFilterBarProps,
  TracesExplorerFilterChipsProps,
  TracesExplorerTimeRangeChipProps,
} from './traces-explorer-filter-bar';
export type { TracesExplorerPanelProps } from './traces-explorer-panel';
export { DEFAULT_TRACES_FILTERS, EMPTY_TRACES_SELECTION, resolveTracesDateWindow } from './traces-explorer-actions';
export type {
  TracesExplorerState,
  TracesFilters,
  TracesSelection,
  TracesSortDirection,
} from './traces-explorer-actions';
export {
  useTraceUsageColumns,
  useTracesColumns,
  useTracesConfig,
  useTracesFilters,
  useTracesList,
  useTracesListFetching,
  useTracesSelection,
} from './traces-explorer-context';
export type { TracesExplorerFeatures, TracesExplorerScope, TracesMetricsSupport } from './traces-explorer-context';
export { useTracesFilterBar, useTracesFilterBarFields } from './use-traces-filter-bar';
export { useTracesDiscovery } from './use-traces-discovery';
