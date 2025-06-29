import { Link, useParams } from 'react-router';

import {
  WorkflowRunProvider,
  Header,
  HeaderTitle,
  MainContentLayout,
  MainLayout,
  MainContent,
  MainHeader,
  MainNavbar,
} from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { useWorkflow } from '@/hooks/use-workflows';

import { WorkflowHeader } from './workflow-header';
import { useWorkflowRuns } from '@/pages/workflows/workflow/hooks/use-workflow-runs';
import { useNewUI } from '@/hooks/use-new-ui';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);
  const { data: runs } = useWorkflowRuns({ workflowId: workflowId! });
  const newUIEnabled = useNewUI();

  if (isWorkflowLoading) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
      </MainContentLayout>
    );
  }

  const run = runs?.runs.find(run => run.runId === runId);

  return newUIEnabled ? (
    <MainLayout>
      <MainHeader>
        <MainNavbar
          linkComponent={Link}
          breadcrumbItems={[
            { label: 'Workflows', to: '/workflows' },
            { label: workflow?.name || '', to: `/workflows/${workflowId}/graph`, isCurrent: true },
          ]}
          navItems={[
            [{ label: 'Graph', to: `/workflows/${workflowId}/graph` }],
            [{ label: 'Traces', to: `/workflows/${workflowId}/traces` }],
          ]}
        />
      </MainHeader>
      <MainContent>{children}</MainContent>
    </MainLayout>
  ) : (
    <WorkflowRunProvider snapshot={typeof run?.snapshot === 'object' ? run.snapshot : undefined}>
      <MainContentLayout>
        <WorkflowHeader workflowName={workflow?.name || ''} workflowId={workflowId!} runId={runId} />
        {children}
      </MainContentLayout>
    </WorkflowRunProvider>
  );
};
