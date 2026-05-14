import {
  Button,
  ButtonWithTooltip,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BookIcon, CalendarClockIcon } from 'lucide-react';
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
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="workflows" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load workflows" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (Object.keys(workflows || {}).length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoWorkflowsInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <WorkflowIcon /> Workflows
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <Button as={Link} to="/workflows/schedules">
              <CalendarClockIcon />
              Schedules
            </Button>
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/workflows/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Workflows documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter workflows" placeholder="Filter by name or description" />
        </div>
      </PageLayout.TopArea>

      <WorkflowsList workflows={workflows || {}} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}

export default Workflows;
