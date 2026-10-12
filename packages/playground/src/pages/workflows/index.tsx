import type { GetWorkflowResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { NoWorkflowsInfo } from '@mastra/playground-ui/domains/workflows/components/workflows-list/no-workflows-info';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import { CalendarClock } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { OverviewPageLayout } from '@/domains/overview/components/overview-page-layout';
import { RunActivityErrorNotice, RunMetricsOffNotice } from '@/domains/overview/components/run-metrics-notices';
import { useOverviewUrlState } from '@/domains/overview/use-overview-url-state';
import { useRunMetricsAvailability } from '@/domains/overview/use-run-metrics-availability';
import {
  defaultWorkflowSort,
  workflowSortKeys,
} from '@/domains/workflows/components/workflows-overview/workflow-roster-row';
import { WorkflowsRoster } from '@/domains/workflows/components/workflows-overview/workflows-roster';
import { useWorkflowsOverview } from '@/domains/workflows/hooks/use-workflows-overview';

const crumbs = [navCrumb('/workflows')];
const skeletonColumns = 'minmax(12rem,2fr) minmax(8rem,1.2fr) 4.5rem 4.5rem 9rem';

function WorkflowsPageState({ children }: { children: ReactNode }) {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Workflows</h1>
      {children}
    </PageLayout>
  );
}

function Workflows() {
  const { data: workflows, isLoading, error } = useWorkflows();
  const availability = useRunMetricsAvailability();

  if (error && is401UnauthorizedError(error)) {
    return (
      <WorkflowsPageState>
        <SessionExpired variant="fill" />
      </WorkflowsPageState>
    );
  }
  if (error && is403ForbiddenError(error)) {
    return (
      <WorkflowsPageState>
        <PermissionDenied variant="fill" resource="workflows" />
      </WorkflowsPageState>
    );
  }
  if (error) {
    return (
      <WorkflowsPageState>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load workflows" descriptionSlot={error.message} />
      </WorkflowsPageState>
    );
  }
  if (workflows && Object.keys(workflows).length === 0) {
    return (
      <WorkflowsPageState>
        <NoWorkflowsInfo />
      </WorkflowsPageState>
    );
  }
  if (isLoading || !workflows || availability.isChecking) {
    return (
      <WorkflowsPageState>
        <DataListSkeleton scroll="page" columns={skeletonColumns} />
      </WorkflowsPageState>
    );
  }
  return <WorkflowsOverview workflows={workflows} showsActivity={availability.showsActivity} />;
}

function WorkflowsOverview({
  workflows,
  showsActivity,
}: {
  workflows: Record<string, GetWorkflowResponse>;
  showsActivity: boolean;
}) {
  const { Link } = useLinkComponent();
  const url = useOverviewUrlState({ sortKeys: workflowSortKeys, defaultSort: defaultWorkflowSort });
  const overview = useWorkflowsOverview({
    workflows,
    range: url.range,
    search: url.search,
    sort: url.sort,
    showsActivity,
  });

  return (
    <OverviewPageLayout
      title="Workflows"
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerLinks={
        <Button size="sm" variant="ghost" icon={<CalendarClock />} render={<Link href="/workflows/schedules" />}>
          Schedules
        </Button>
      }
      search={url.search}
      onSearchChange={url.onSearchChange}
      searchLabel="Filter workflows"
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
        <WorkflowsRoster
          rows={overview.rows}
          activity={overview.rosterActivity}
          showsSuspended={overview.showsSuspended}
          sort={url.sort}
          onSortChange={url.onSortChange}
        />
      )}
    </OverviewPageLayout>
  );
}

export default Workflows;
