import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { CalendarClockIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { NoWorkflowsInfo } from '@/domains/workflows/components/workflows-list/no-workflows-info';
import { WorkflowsList } from '@/domains/workflows/components/workflows-list/workflows-list';
import type { WorkflowsSort } from '@/domains/workflows/components/workflows-list/workflows-sort';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

const crumbs = [navCrumb('/workflows')];

function Workflows() {
  const { data: workflows, isLoading, error } = useWorkflows();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<WorkflowsSort>();

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="workflows" />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <div className="flex h-full items-center justify-center">
          <ErrorState title="Failed to load workflows" message={error.message} />
        </div>
      </PageLayout>
    );
  }

  if (Object.keys(workflows || {}).length === 0 && !isLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <div className="flex h-full items-center justify-center">
          <NoWorkflowsInfo />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      actionRow={
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="max-w-120 flex-1">
            <ListSearch onSearch={setSearch} label="Filter workflows" placeholder="Filter by name or description" />
          </div>
          <Button
            render={<Link to="/workflows/schedules" />}

            variant="primary"
            className="shrink-0"
            icon={<CalendarClockIcon />}
          >
            Schedules
          </Button>
        </div>
      }
    >
      <WorkflowsList
        workflows={workflows || {}}
        isLoading={isLoading}
        search={search}
        sort={sort}
        onSortChange={(direction, key) => setSort({ key, direction })}
      />
    </PageLayout>
  );
}

export default Workflows;
