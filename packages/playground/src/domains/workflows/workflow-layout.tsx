import { ErrorBoundary } from '@mastra/playground-ui/components/ErrorBoundary';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useParams } from 'react-router';
import { WorkflowRunCopyAction, WorkflowRunCrumb } from './workflow-crumbs';
import { WorkflowHeader } from './workflow-header';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb, workflowCrumb, type CrumbDef } from '@/domains/navigation/crumbs';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
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
  const crumbs: CrumbDef[] = [
    navCrumb('/workflows'),
    // The `to` link only renders on the nested graph/:runId route.
    runId ? { ...workflowCrumb, to: `/workflows/${encodeURIComponent(workflowId ?? '')}/graph` } : workflowCrumb,
    ...(runId ? [{ id: 'workflow-run', Component: WorkflowRunCrumb, Action: WorkflowRunCopyAction }] : []),
  ];

  if (!workflowId) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="grid grid-rows-[auto_minmax(0,1fr)] p-4">
        <div className="flex h-full flex-col items-center justify-center">
          <Txt variant="ui-md" className="text-foreground text-center">
            No workflow ID provided
          </Txt>
        </div>
      </PageLayout>
    );
  }

  if (isWorkflowLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="grid grid-rows-[auto_minmax(0,1fr)] p-4">
        <Skeleton className="h-full" />
      </PageLayout>
    );
  }

  return (
    <TracingSettingsProvider entityId={workflowId} entityType="workflow">
      <SchemaRequestContextProvider>
        <WorkflowStepDetailProvider key={workflowId}>
          <WorkflowRunProvider workflowId={workflowId} initialRunId={runId}>
            <WorkflowSelectedStepProvider>
              <PageLayout
                breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
                actions={<WorkflowHeader workflowName={workflow?.name || ''} workflowId={workflowId} />}
                className="grid grid-rows-[minmax(0,1fr)]"
              >
                <WorkflowLayoutUI leftSlot={<WorkflowInformation workflowId={workflowId} initialRunId={runId} />}>
                  {children}
                </WorkflowLayoutUI>
              </PageLayout>
            </WorkflowSelectedStepProvider>
          </WorkflowRunProvider>
        </WorkflowStepDetailProvider>
      </SchemaRequestContextProvider>
    </TracingSettingsProvider>
  );
}
