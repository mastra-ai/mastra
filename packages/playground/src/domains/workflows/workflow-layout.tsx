import type { WorkflowRunState } from '@mastra/core/workflows';
import { Header, HeaderTitle, MainContentLayout, MainContentContent, Skeleton, Txt } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { WorkflowHeader } from './workflow-header';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { WorkflowInformation } from '@/domains/workflows/components/workflow-information';
import { WorkflowLayout as WorkflowLayoutUI } from '@/domains/workflows/components/workflow-layout';
import { WorkflowRunProvider } from '@/domains/workflows/context/workflow-run-context';
import { WorkflowRunList } from '@/domains/workflows/runs/workflow-run-list';
import { useWorkflowRun } from '@/hooks/use-workflow-runs';
import { useWorkflow } from '@/hooks/use-workflows';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);
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
          },
          status: runExecutionResult?.status,
          result: runExecutionResult?.result,
          error: runExecutionResult?.error,
          runId,
          serializedStepGraph: runExecutionResult?.serializedStepGraph,
        } as WorkflowRunState)
      : undefined;

  return (
    <TracingSettingsProvider entityId={workflowId} entityType="workflow">
      <SchemaRequestContextProvider>
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
      </SchemaRequestContextProvider>
    </TracingSettingsProvider>
  );
};
