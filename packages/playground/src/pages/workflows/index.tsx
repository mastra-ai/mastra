import {
  Button,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  WorkflowIcon,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { CalendarClockIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { NoWorkflowsInfo } from '@/domains/workflows/components/workflows-list/no-workflows-info';
import { WorkflowsList } from '@/domains/workflows/components/workflows-list/workflows-list';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

function Workflows() {
  const { data: workflows, isLoading, error } = useWorkflows();
  const [search, setSearch] = useState('');

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Workflows" icon={<WorkflowIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Workflows" icon={<WorkflowIcon />}>
        <PermissionDenied resource="workflows" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Workflows" icon={<WorkflowIcon />}>
        <ErrorState title="Failed to load workflows" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(workflows || {}).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout title="Workflows" icon={<WorkflowIcon />}>
        <NoWorkflowsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <div className="flex items-center justify-between gap-3">
          <div className="max-w-120 flex-1">
            <ListSearch onSearch={setSearch} label="Filter workflows" placeholder="Filter by name or description" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button as={Link} to="/workflows/schedules" variant="ghost">
              <CalendarClockIcon />
              Schedules
            </Button>
          </div>
        </div>
      </PageLayout.TopArea>

      <WorkflowsList workflows={workflows || {}} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}

export default Workflows;
