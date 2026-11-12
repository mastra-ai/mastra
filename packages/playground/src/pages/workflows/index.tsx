import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SearchInput, listSearchProps } from '@mastra/playground-ui/components/SearchInput';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { NoWorkflowsInfo } from '@mastra/playground-ui/domains/workflows/components/workflows-list/no-workflows-info';
import { WorkflowsList } from '@mastra/playground-ui/domains/workflows/components/workflows-list/workflows-list';
import type { WorkflowsSort } from '@mastra/playground-ui/domains/workflows/components/workflows-list/workflows-sort';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import { CalendarClockIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/workflows')];

function Workflows() {
  const { data: workflows, isLoading, error } = useWorkflows();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<WorkflowsSort>();

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workflows</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workflows</h1>
        <PermissionDenied variant="fill" resource="workflows" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workflows</h1>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load workflows" descriptionSlot={error.message} />
      </PageLayout>
    );
  }

  if (Object.keys(workflows || {}).length === 0 && !isLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Workflows</h1>
        <NoWorkflowsInfo />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <div className="max-w-120 flex-1">
              <SearchInput
                {...listSearchProps}
                onValueChange={setSearch}
                label="Search workflows"
                placeholder="Search by name or description"
              />
            </div>
          </ActionRow.Start>
          <ActionRow.End>
            <Button render={<Link to="/workflows/schedules" />} variant="primary" icon={<CalendarClockIcon />}>
              Schedules
            </Button>
          </ActionRow.End>
        </ActionRow>
      }
    >
      <h1 className="sr-only">Workflows</h1>
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
