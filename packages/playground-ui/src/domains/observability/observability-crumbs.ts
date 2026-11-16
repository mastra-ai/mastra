import type { ObservabilityBreadcrumbsState } from './components/observability-page-layout';
import type { ObservabilityView } from '@/domains/traces/components/traces-spans-switch';

export const OBSERVABILITY_VIEW_LABELS: Record<ObservabilityView, string> = {
  traces: 'Traces',
  spans: 'Spans',
  threads: 'Threads',
};

/**
 * The crumb naming the current view after the root "Traces" crumb, or `undefined` when none is needed:
 * on the traces page, while the views load, or when the switch already shows which view is open.
 */
export function observabilityViewCrumbLabel({
  current,
  isLoading,
  showSwitch,
}: ObservabilityBreadcrumbsState): string | undefined {
  if (isLoading || showSwitch || current === 'traces') return undefined;
  return OBSERVABILITY_VIEW_LABELS[current];
}
