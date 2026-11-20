import type {
  TracesExplorerCapabilities,
  TracesExplorerFeatures,
  TracesFilters,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { App } from '@modelcontextprotocol/ext-apps';
import type { OpenedTraceFilter } from '../../../shared/mcp-tools';

export type UseMcpTracesArgs = {
  app: App;
  /** The model's leftover query: it narrows every trace query. */
  opened?: OpenedTraceFilter;
  filters: TracesFilters;
  capabilities: TracesExplorerCapabilities;
  features?: TracesExplorerFeatures;
};
