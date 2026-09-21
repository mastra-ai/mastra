import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { CalendarClockIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { navCrumb } from '@/domains/navigation/crumbs';
import { NoWorkflowsInfo } from '@/domains/workflows/components/workflows-list/no-workflows-info';
import { WorkflowsList } from '@/domains/workflows/components/workflows-list/workflows-list';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

const crumbs = [navCrumb('/workflows')];

function Workflows() {
  const { data: workflows, isLoading, error } = useWorkflows();
  const [search, setSearch] = useState('');

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <PermissionDenied resource="workflows" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <ErrorState title="Failed to load workflows" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(workflows || {}).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout {...pageHeaderProps(crumbs)}>
        <NoWorkflowsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout {...pageHeaderProps(crumbs)} height="full">
      <PageLayout.TopArea>
        <PageLayout.Row align="center" stack="responsive">
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
        </PageLayout.Row>
      </PageLayout.TopArea>

      <WorkflowsList workflows={workflows || {}} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}

export default Workflows;
