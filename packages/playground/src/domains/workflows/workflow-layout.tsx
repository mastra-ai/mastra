import type { WorkflowRunState } from '@mastra/core/workflows';
import { Skeleton, Txt } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { WorkflowHeader } from './workflow-header';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { WorkflowInformation } from '@/domains/workflows/components/workflow-information';
import { WorkflowLayout as WorkflowLayoutUI } from '@/domains/workflows/components/workflow-layout';
import { WorkflowRunProvider } from '@/domains/workflows/context/workflow-run-provider';
import { useWorkflowRun } from '@/hooks/use-workflow-runs';
import { useWorkflow } from '@/hooks/use-workflows';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);
  const { data: runExecutionResult, isLoading: isRunLoading } = useWorkflowRun(workflowId ?? '', runId ?? '');

  if (!workflowId) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Txt variant="ui-md" className="text-neutral6 text-center">
          No workflow ID provided
        </Txt>
      </div>
    );
  }

  if (isWorkflowLoading || (Boolean(runId) && isRunLoading)) {
    return (
      <div className="h-full p-4">
        <Skeleton className="h-full" />
      </div>
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
          <div className="h-full min-h-0">
            <WorkflowHeader workflowName={workflow?.name || ''} workflowId={workflowId} />
            <WorkflowLayoutUI
              workflowId={workflowId!}
              leftSlot={<WorkflowInformation workflowId={workflowId} initialRunId={runId} />}
            >
              {children}
            </WorkflowLayoutUI>
          </div>
        </WorkflowRunProvider>
      </SchemaRequestContextProvider>
    </TracingSettingsProvider>
  );
};
