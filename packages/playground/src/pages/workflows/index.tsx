import {
  ButtonWithTooltip,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  Tab,
  TabContent,
  TabList,
  Tabs,
  WorkflowIcon,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';
import { SchedulesPage } from '@/domains/schedules/components/schedules-page';
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
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <WorkflowIcon /> Workflows
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
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
      </PageLayout.TopArea>

      <Tabs defaultTab="workflows" className="grid grid-rows-[auto_1fr] h-full overflow-hidden">
        <TabList>
          <Tab value="workflows">All Workflows</Tab>
          <Tab value="schedules">Schedules</Tab>
        </TabList>

        <TabContent value="workflows" className="overflow-y-auto mt-5">
          <div className="max-w-120 mb-4">
            <ListSearch onSearch={setSearch} label="Filter workflows" placeholder="Filter by name or description" />
          </div>
          <WorkflowsList workflows={workflows || {}} isLoading={isLoading} search={search} />
        </TabContent>

        <TabContent value="schedules" className="overflow-hidden mt-5">
          <SchedulesPage />
        </TabContent>
      </Tabs>
    </PageLayout>
  );
}

export default Workflows;
