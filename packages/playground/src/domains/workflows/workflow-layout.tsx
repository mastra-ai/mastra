import { useParams } from 'react-router';

import {
  WorkflowRunProvider,
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  useWorkflow,
  useWorkflowDefinition,
  WorkflowRunList,
  WorkflowInformation,
  useWorkflowRun,
  Skeleton,
  Txt,
  TracingSettingsProvider,
  WorkflowLayout as WorkflowLayoutUI,
} from '@mastra/playground-ui';

import { WorkflowHeader } from './workflow-header';
import { WorkflowRunState } from '@mastra/core/workflows';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();

  // useWorkflow now works for both code-defined and stored workflows
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);

  // Check if this is a stored workflow definition (for Edit button)
  const { data: storedWorkflow } = useWorkflowDefinition(workflowId);
  const isStoredWorkflow = !!storedWorkflow;

  const { data: runExecutionResult } = useWorkflowRun(workflowId ?? '', runId ?? '');

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
            <Txt variant="ui-md" className="text-neutral6 text-center">
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
          <WorkflowHeader
            workflowName={workflow?.name || ''}
            workflowId={workflowId}
            runId={runId}
            isStoredWorkflow={isStoredWorkflow}
          />
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
