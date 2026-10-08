import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { PageLayoutProps } from '@mastra/playground-ui/components/PageLayout';
import { useContext } from 'react';
import { MetricsAgentScopeContext } from '../context/metrics-agent-scope';
import { metricsCrumbs } from '../metrics-crumbs';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

/** Agent pages already own their breadcrumb; the dashboard only adds its controls and body. */
export function MetricsLayout(props: Pick<PageLayoutProps, 'children' | 'actionRow'>) {
  const scope = useContext(MetricsAgentScopeContext);
  return <PageLayout breadcrumbs={scope ? undefined : <PageBreadcrumbs crumbs={metricsCrumbs} />} {...props} />;
}
