import observabilityExplorerHtml from '../apps-dist/observability-explorer.html?raw';
import type { McpAppResource } from './app-resource';

/**
 * Studio's observability explorer: filters with field and value discovery, a histogram, sorting and paging over traces,
 * plus span and thread lists; a picked row opens with the trace viewer's timeline. Every read goes through the
 * built-in server's observability tools (`query_traces`, `aggregate_traces`, `get_trace_query_fields`,
 * `get_trace_query_values`, `query_spans`, `aggregate_spans`, `query_threads`, `get_trace`, `get_span`) and its
 * app-only `get_observability_capabilities`. The tool that opens it passes its `query_traces` arguments, whose time
 * range, sort and filters the app starts from.
 */
export const observabilityExplorerApp: McpAppResource = {
  name: 'Observability explorer',
  description: 'Lists, filters and charts traces, spans and threads',
  html: observabilityExplorerHtml,
};
