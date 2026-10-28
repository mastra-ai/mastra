import type { ReactNode } from 'react';
import { useObservabilityViews } from '../hooks/use-observability-views';
import type { ObservabilityViewsState } from '../hooks/use-observability-views';
import type { TracesExplorerFeatures } from '@/domains/traces/components/traces-explorer/traces-explorer-context';
import { TracesSpansSwitch, TracesSpansSwitchSkeleton } from '@/domains/traces/components/traces-spans-switch';
import type { ObservabilityView } from '@/domains/traces/components/traces-spans-switch';
import { PageLayout } from '@/ds/components/PageLayout';

export type ObservabilityBreadcrumbsState = Pick<ObservabilityViewsState, 'isLoading' | 'showSwitch'> & {
  current: ObservabilityView;
};

export type ObservabilityPageLayoutProps = {
  current: ObservabilityView;
  features?: TracesExplorerFeatures;
  onViewChange: (view: ObservabilityView) => void;
  /** The host's breadcrumbs. They can name the current view when the switch does not show it. */
  breadcrumbs: (state: ObservabilityBreadcrumbsState) => ReactNode;
  children: ReactNode;
};

/**
 * The header shared by the traces, spans and threads pages: breadcrumbs plus the view switch
 * under them. Router-agnostic: the host passes the current view, navigation and its page body.
 */
export function ObservabilityPageLayout({
  current,
  features,
  onViewChange,
  breadcrumbs,
  children,
}: ObservabilityPageLayoutProps) {
  const { views, isLoading, showSwitch } = useObservabilityViews({ current, features });

  // While loading, hold the switch's place so it does not push the page down when it lands.
  let viewSwitch: ReactNode;
  if (isLoading) viewSwitch = <TracesSpansSwitchSkeleton />;
  else if (showSwitch) viewSwitch = <TracesSpansSwitch current={current} views={views} onViewChange={onViewChange} />;

  return (
    <PageLayout breadcrumbs={breadcrumbs({ current, isLoading, showSwitch })}>
      {viewSwitch}
      <PageLayout.Fill>{children}</PageLayout.Fill>
    </PageLayout>
  );
}
