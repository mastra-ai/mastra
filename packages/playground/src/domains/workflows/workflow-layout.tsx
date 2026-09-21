import { ErrorBoundary } from '@mastra/playground-ui/components/ErrorBoundary';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RequestContextProvider } from '@mastra/playground-ui/domains/request-context';
import { useParams } from 'react-router';
import { WorkflowHeader } from './workflow-header';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { WorkflowInformation } from '@/domains/workflows/components/workflow-information';
import { WorkflowLayout as WorkflowLayoutUI } from '@/domains/workflows/components/workflow-layout';
import { WorkflowRunProvider } from '@/domains/workflows/context/workflow-run-provider';
import { WorkflowSelectedStepProvider } from '@/domains/workflows/context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '@/domains/workflows/context/workflow-step-detail-provider';
import { useWorkflow } from '@/hooks/use-workflows';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();
  return (
    <ErrorBoundary
      resetKeys={[workflowId, runId]}
      title="Unable to display this workflow"
      description="The workflow data could not be displayed. Try again or open another workflow."
    >
      <WorkflowRoute>{children}</WorkflowRoute>
    </ErrorBoundary>
  );
};

function WorkflowRoute({ children }: { children: React.ReactNode }) {
  const { workflowId, runId } = useParams();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);

  if (!workflowId) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Txt variant="ui-md" className="text-neutral6 text-center">
          No workflow ID provided
        </Txt>
      </div>
    );
  }

  if (isWorkflowLoading) {
    return (
      <div className="h-full p-4">
        <Skeleton className="h-full" />
      </div>
    );
  }

  return (
    <TracingSettingsProvider entityId={workflowId} entityType="workflow">
      <RequestContextProvider key={workflowId} entityKey={`workflow:${workflowId}`}>
        <WorkflowStepDetailProvider key={workflowId}>
          <WorkflowRunProvider workflowId={workflowId} initialRunId={runId}>
            <WorkflowSelectedStepProvider>
              <div className="flex h-full min-h-0 flex-col">
                <WorkflowHeader workflowName={workflow?.name || ''} workflowId={workflowId} />
                <WorkflowLayoutUI leftSlot={<WorkflowInformation workflowId={workflowId} initialRunId={runId} />}>
                  {children}
                </WorkflowLayoutUI>
              </div>
            </WorkflowSelectedStepProvider>
          </WorkflowRunProvider>
        </WorkflowStepDetailProvider>
      </RequestContextProvider>
    </TracingSettingsProvider>
  );
}
