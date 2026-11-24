import { TracesExplorerBody } from './traces-explorer-body';
import { TracesExplorerColumnsMenu } from './traces-explorer-columns-menu';
import {
  TracesExplorerFilterBar,
  TracesExplorerFilterChips,
  TracesExplorerTimeRangeChip,
} from './traces-explorer-filter-bar';
import { TracesExplorerHistogram } from './traces-explorer-histogram';
import { TracesExplorerLayout } from './traces-explorer-layout';
import { TracesExplorerList } from './traces-explorer-list';
import { TracesExplorerPanel } from './traces-explorer-panel';
import { TracesExplorerRoot } from './traces-explorer-root';
import { TracesExplorerSavedViews } from './traces-explorer-saved-views';

/**
 * The traces page as a compound component that never fetches: the root takes the host's state, what
 * the store supports and the list; each part takes its own records; every action goes back to the host
 * through a callback. Studio loads the records with the `use-traces-*-query` hooks; any other host
 * (e.g. an MCP server app) builds the same records from its own transport.
 */
export const TracesExplorer = Object.assign(TracesExplorerRoot, {
  Layout: TracesExplorerLayout,
  Body: TracesExplorerBody,
  FilterBar: TracesExplorerFilterBar,
  FilterChips: TracesExplorerFilterChips,
  TimeRangeChip: TracesExplorerTimeRangeChip,
  ColumnsMenu: TracesExplorerColumnsMenu,
  Histogram: TracesExplorerHistogram,
  List: TracesExplorerList,
  Panel: TracesExplorerPanel,
  SavedViews: TracesExplorerSavedViews,
});

export type { TracesExplorerRootProps } from './traces-explorer-root';
export type { TracesExplorerErrorRenderArgs, TracesExplorerLayoutProps } from './traces-explorer-layout';
export type { TracesExplorerBodyProps } from './traces-explorer-body';
export type {
  TracesExplorerFilterBarProps,
  TracesExplorerFilterChipsProps,
  TracesExplorerTimeRangeChipProps,
} from './traces-explorer-filter-bar';
export type { TracesExplorerHistogramProps } from './traces-explorer-histogram';
export type { TracesExplorerListProps } from './traces-explorer-list';
export type {
  TracesExplorerPanelDatasetDialogArgs,
  TracesExplorerPanelFeedbackArgs,
  TracesExplorerPanelProps,
  TracesExplorerPanelSpanFeedbackArgs,
  TracesExplorerPanelThreadArgs,
} from './traces-explorer-panel';
export type { TracesExplorerSavedViewsProps } from './traces-explorer-saved-views';
export {
  DEFAULT_TRACES_FILTERS,
  DEFAULT_TRACES_SORT,
  EMPTY_TRACES_SELECTION,
  TRACES_SORT_FIELDS,
  resolveTracesDateWindow,
} from './traces-explorer-actions';
export type {
  TracesExplorerState,
  TracesFilters,
  TracesSelection,
  TracesSort,
  TracesSortDirection,
  TracesSortField,
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
export { NO_TRACES_DISCOVERY } from './traces-explorer-data';
export type {
  TracesExplorerCapabilities,
  TracesExplorerDiscovery,
  TracesExplorerFilterSuggestions,
  TracesExplorerHistogram,
  TracesExplorerOpenTrace,
  TracesExplorerTraces,
  TracesExplorerUsage,
} from './traces-explorer-data';
export {
  buildTracesHistogramRequest,
  buildTracesListLegacyFilters,
  buildTracesListQuery,
  canShowTracesHistogram,
  resolveTraceUsageColumns,
  resolveTracesSort,
  resolveTracesSupport,
  sanitizeTracesFiltersFor,
} from './traces-explorer-support';
export type {
  TraceUsageColumns,
  TracesExplorerFeatures,
  TracesExplorerScope,
  TracesMetricsSupport,
  TracesRootSource,
  TracesSupport,
} from './traces-explorer-support';
export { useTracesDateWindow } from './use-traces-date-window';
export { useTracesFilterBar, useTracesFilterBarFields } from './use-traces-filter-bar';

export type { FeedbackOptions } from '../feedback-options';
