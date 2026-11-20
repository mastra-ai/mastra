import type {
  AggregateTracesResponse,
  ClientScoreRowData,
  GetObservabilityCapabilitiesResponse,
  GetTraceQueryFieldsResponse,
} from '@mastra/client-js';
import type { TraceMetadataFilterField, TraceQueryValuesResolver } from '@mastra/react/hooks/traces';
import type { TraceUsageSummary } from '../../trace-list-columns';
import type { TraceQueryRelatedScope } from '../../trace-query-filters';
import type { SpanRecord, TraceSpanRecord } from '../../types';
import type { TracePanelSpan } from '../trace-panel';
import type { TracesListViewTrace } from '../traces-list-view';

/*
 * The data contract of the traces explorer. Every part renders from these records alone: the explorer
 * never fetches. Studio builds them through its Mastra client (the `use-traces-*-query` hooks); any other
 * host (e.g. an MCP server app) builds them from its own transport and passes them down the same way.
 */

/** What the store supports, as `getObservabilityCapabilities()` returns it. Missing flags take an older server's defaults. */
export type TracesExplorerCapabilities = {
  data?: GetObservabilityCapabilitiesResponse;
  isLoading: boolean;
};

/** The traces list: the rows of every page loaded so far, and how to get more. */
export type TracesExplorerTraces = {
  rows: TracesListViewTrace[];
  /** The first page is loading: the list shows its skeleton. */
  isLoading: boolean;
  /** A request is in flight, background refreshes included. */
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error?: Error;
  /** Loads the next page. Called once the end of the list scrolls into view while it has one. */
  onLoadMore: () => void;
  /** Loads the list again after an error. */
  onRetry: () => void;
};

/** The metadata fields observed on traces in the explorer's window (trace query discovery). */
export type TracesExplorerDiscovery = {
  /** `metadata.<key>` fields, each with a lazy resolver of its observed values. */
  fields: readonly TraceMetadataFilterField[];
  canonicalFields: GetTraceQueryFieldsResponse['canonicalFields'];
  /** While discovery loads, the explorer body holds its skeleton so the filter bar never shows half its fields. */
  isLoading: boolean;
};

/** The values the filter bar suggests for its fields. */
export type TracesExplorerFilterSuggestions = {
  /** Names of the root entities (agents, workflows…) the `Primitive name` field picks from. Omitted, it takes free text. */
  rootEntityNames?: string[];
  /** Environments the `Environment` field picks from. Omitted, it takes free text. */
  environments?: string[];
  /** A lazy resolver of the values observed for a field (`spans.model`, `metadata.region`…). Without it, those fields take free text. */
  resolveValues?: (scope: TraceQueryRelatedScope | 'trace', path: string) => TraceQueryValuesResolver;
};

/** Trace and error counts over the list's window, as `aggregateTraces()` returns them for the histogram request. */
export type TracesExplorerHistogram = {
  /** The window the counts cover: the request's `timeRange`. */
  timeRange: { from: string; to: string };
  rows: AggregateTracesResponse['rows'];
  isLoading: boolean;
  isError: boolean;
  /** The previous counts stay on screen, dimmed, while the new ones load. */
  isUpdating: boolean;
};

/** Token and estimated-cost totals by trace id. */
export type TracesExplorerUsage = ReadonlyMap<string, TraceUsageSummary>;

/** The records of the trace open in the panel. */
export type TracesExplorerOpenTrace = {
  /** The trace's spans (`getTrace`); `undefined` while they load. */
  spans?: TracePanelSpan[];
  isLoading: boolean;
  /** The span a branch view is anchored on; omitted, the panel anchors on the root span. */
  anchorSpanId?: string;
  /** The trace's spans with their payloads, behind the Messages column, the signal labels and the tool results. */
  fullTrace?: { spans?: TraceSpanRecord[]; isLoading: boolean; error?: Error };
  /** The open span's record (`getSpan`). */
  selectedSpan?: { span?: SpanRecord; isLoading: boolean };
  usage?: TraceUsageSummary;
  /** The trace's thread holds other turns, so the panel offers to open the full thread. */
  threadHasOtherTraces?: boolean;
  /** Counts shown on the Feedback tabs. */
  feedbackCount?: number;
  spanFeedbackCount?: number;
  /** The root span's scores: their total on the Scores tab, and the records a selected score is drawn from. */
  scores?: { total?: number; records: ClientScoreRowData[] };
};

export const NO_TRACES_DISCOVERY: TracesExplorerDiscovery = { fields: [], canonicalFields: [], isLoading: false };
