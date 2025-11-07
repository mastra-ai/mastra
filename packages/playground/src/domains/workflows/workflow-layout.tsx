import { useParams } from 'react-router';

import {
  WorkflowRunProvider,
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  useWorkflow,
  WorkflowRunList,
  WorkflowInformation,
  useWorkflowRunExecutionResult,
  Skeleton,
} from '@mastra/playground-ui';

import { WorkflowHeader } from './workflow-header';
import { WorkflowRunState } from '@mastra/core/workflows';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);
  const { data: runExecutionResult } = useWorkflowRunExecutionResult(workflowId ?? '', runId ?? '');

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

  const snapshot =
    runExecutionResult && runId
      ? ({
          context: {
            input: runExecutionResult?.payload,
            ...runExecutionResult?.steps,
          } as any,
          status: runExecutionResult?.status,
          result: runExecutionResult?.result,
          error: runExecutionResult?.error,
          runId,
        } as WorkflowRunState)
      : undefined;

  return (
    <WorkflowRunProvider snapshot={snapshot}>
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
