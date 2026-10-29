import { useSpanQueryAvailable, useThreadQueryAvailable } from '@/domains/capabilities';
import type { TracesExplorerFeatures } from '@/domains/traces/components/traces-explorer/traces-explorer-context';
import type { ObservabilityView } from '@/domains/traces/components/traces-spans-switch';

export type UseObservabilityViewsArgs = {
  /** The view the host is showing. */
  current: ObservabilityView;
  /** Host switches: a spans or threads view is offered only when its flag is `true` and the server supports it. */
  features?: TracesExplorerFeatures;
};

export type ObservabilityViewsState = {
  /** The views to offer, in order. Traces is always first. */
  views: ObservabilityView[];
  /** The store capabilities that decide the views are still loading. */
  isLoading: boolean;
  /** More than one view is available and the current one is among them. */
  showSwitch: boolean;
};

/**
 * The observability views a host can switch between. Reads the capabilities directly, so it works
 * outside a `TracesExplorer` (e.g. in a layout shared by the traces, spans and threads pages).
 */
export function useObservabilityViews({ current, features }: UseObservabilityViewsArgs): ObservabilityViewsState {
  const spanQuery = useSpanQueryAvailable();
  const threadQuery = useThreadQueryAvailable();

  const views: ObservabilityView[] = ['traces'];
  if (spanQuery.enabled && features?.spanQuery === true) views.push('spans');
  if (threadQuery.enabled && features?.threadQuery === true) views.push('threads');

  const isLoading = spanQuery.isLoading || threadQuery.isLoading;
  const showSwitch = !isLoading && views.length > 1 && views.includes(current);

  return { views, isLoading, showSwitch };
}
