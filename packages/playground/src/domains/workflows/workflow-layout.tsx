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
  Txt,
  TracingSettingsProvider,
  WorkflowLayout as WorkflowLayoutUI,
} from '@mastra/playground-ui';

import { WorkflowHeader } from './workflow-header';
import { WorkflowRunState } from '@mastra/core/workflows';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);
  const { data: runExecutionResult } = useWorkflowRunExecutionResult(workflowId ?? '', runId ?? '');

  if (!workflowId) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
        <MainContentContent isCentered={true}>
          <div className="flex flex-col items-center justify-center h-full">
            <Txt variant="ui-md" className="text-icon6 text-center">
              No workflow ID provided
            </Txt>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

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
          serializedStepGraph: runExecutionResult?.serializedStepGraph,
        } as WorkflowRunState)
      : undefined;

  return (
    <TracingSettingsProvider entityId={workflowId} entityType="workflow">
      <WorkflowRunProvider snapshot={snapshot} workflowId={workflowId} initialRunId={runId}>
        <MainContentLayout>
          <WorkflowHeader workflowName={workflow?.name || ''} workflowId={workflowId} runId={runId} />
          <WorkflowLayoutUI
            workflowId={workflowId!}
            leftSlot={<WorkflowRunList workflowId={workflowId} runId={runId} />}
            rightSlot={<WorkflowInformation workflowId={workflowId} initialRunId={runId} />}
          >
            {children}
          </WorkflowLayoutUI>
        </MainContentLayout>
      </WorkflowRunProvider>
    </TracingSettingsProvider>
  );
};
