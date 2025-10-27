import { useParams } from 'react-router';

import {
  WorkflowRunProvider,
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  useWorkflow,
  useWorkflowRuns,
  WorkflowRunList,
  WorkflowInformation,
} from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { WorkflowHeader } from './workflow-header';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);
  const { data: runs } = useWorkflowRuns(workflowId!);

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

  return (
    <WorkflowRunProvider snapshot={typeof run?.snapshot === 'object' ? run.snapshot : undefined}>
      <MainContentLayout>
        <WorkflowHeader workflowName={workflow?.name || ''} workflowId={workflowId!} runId={runId} />
        <MainContentContent isDivided={true} hasLeftServiceColumn={true}>
          <WorkflowRunList workflowId={workflowId!} runId={runId} />

          {children}

          <WorkflowInformation workflowId={workflowId!} initialRunId={runId} />
        </MainContentContent>
      </MainContentLayout>
    </WorkflowRunProvider>
  );
};
