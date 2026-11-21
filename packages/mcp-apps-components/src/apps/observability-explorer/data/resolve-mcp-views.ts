import type {
  TracesExplorerCapabilities,
  TracesExplorerFeatures,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';

/** Whether a list tab shows: the server queries it and the app offers it. */
export function resolveMcpViews(capabilities: TracesExplorerCapabilities, features: TracesExplorerFeatures) {
  const flags = capabilities.data?.capabilities;
  return {
    spans: Boolean(flags?.spanQuery) && features.spanQuery === true,
    threads: Boolean(flags?.threadQueryRows) && features.threadQuery === true,
  };
}
