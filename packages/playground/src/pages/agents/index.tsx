import type { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { MetricsIcon } from '@mastra/playground-ui/icons/MetricsIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useAgents } from '@mastra/react/hooks/agents';
import type { ReactNode } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { NoAgentsInfo } from '@/domains/agents/components/agent-list/no-agents-info';
import { agentSortKeys, defaultAgentSort } from '@/domains/agents/components/agents-overview/agent-roster-row';
import { AgentsRoster } from '@/domains/agents/components/agents-overview/agents-roster';
import { useAgentsOverview } from '@/domains/agents/hooks/use-agents-overview';
import { navCrumb } from '@/domains/navigation/crumbs';
import { OverviewPageLayout } from '@/domains/overview/components/overview-page-layout';
import { RunActivityErrorNotice, RunMetricsOffNotice } from '@/domains/overview/components/run-metrics-notices';
import { useOverviewUrlState } from '@/domains/overview/use-overview-url-state';
import { useRunMetricsAvailability } from '@/domains/overview/use-run-metrics-availability';

const crumbs = [navCrumb('/agents')];
const skeletonColumns = 'minmax(12rem,2fr) minmax(8rem,1.2fr) 4.5rem 4.5rem 9rem';

function AgentsPageState({ children }: { children: ReactNode }) {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Agents</h1>
      {children}
    </PageLayout>
  );
}

function Agents() {
  const { data: agents, isLoading, error } = useAgents();
  const availability = useRunMetricsAvailability();

  if (error && is401UnauthorizedError(error)) {
    return (
      <AgentsPageState>
        <SessionExpired variant="fill" />
      </AgentsPageState>
    );
  }
  if (error && is403ForbiddenError(error)) {
    return (
      <AgentsPageState>
        <PermissionDenied variant="fill" resource="agents" />
      </AgentsPageState>
    );
  }
  if (error) {
    return (
      <AgentsPageState>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load agents" descriptionSlot={error.message} />
      </AgentsPageState>
    );
  }
  if (agents && Object.keys(agents).length === 0) {
    return (
      <AgentsPageState>
        <NoAgentsInfo />
      </AgentsPageState>
    );
  }
  if (isLoading || !agents || availability.isChecking) {
    return (
      <AgentsPageState>
        <DataListSkeleton scroll="page" columns={skeletonColumns} />
      </AgentsPageState>
    );
  }
  return <AgentsOverview agents={agents} showsActivity={availability.showsActivity} />;
}

function AgentsOverview({
  agents,
  showsActivity,
}: {
  agents: Record<string, GetAgentResponse>;
  showsActivity: boolean;
}) {
  const { Link } = useLinkComponent();
  const url = useOverviewUrlState({ sortKeys: agentSortKeys, defaultSort: defaultAgentSort });
  const overview = useAgentsOverview({
    agents,
    range: url.range,
    search: url.search,
    sort: url.sort,
    showsActivity,
  });

  return (
    <OverviewPageLayout
      title="Agents"
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerLinks={
        <Button size="sm" variant="ghost" icon={<MetricsIcon />} render={<Link href="/metrics" />}>
          Metrics
        </Button>
      }
      search={url.search}
      onSearchChange={url.onSearchChange}
      searchLabel="Filter agents"
      period={
        showsActivity
          ? {
              range: url.range,
              onRangeChange: url.onRangeChange,
              totals: overview.totals,
              regressions: overview.regressions,
            }
          : undefined
      }
      notice={
        showsActivity ? overview.error && <RunActivityErrorNotice error={overview.error} /> : <RunMetricsOffNotice />
      }
    >
      {overview.isLoading ? (
        <DataListSkeleton scroll="page" columns={skeletonColumns} />
      ) : (
        <AgentsRoster
          rows={overview.rows}
          activity={overview.rosterActivity}
          sort={url.sort}
          onSortChange={url.onSortChange}
        />
      )}
    </OverviewPageLayout>
  );
}

export { Agents };

export default Agents;
