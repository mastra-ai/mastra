import { ErrorBoundary } from '@mastra/playground-ui/components/ErrorBoundary';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { KeyboardScope } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useLocation, useNavigate, useParams } from 'react-router';
import { WorkflowRunCopyAction, WorkflowRunCrumb } from './workflow-crumbs';
import { WorkflowHeader } from './workflow-header';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { navCrumb, workflowCrumb, type CrumbDef } from '@/domains/navigation/crumbs';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { WorkflowInformation } from '@/domains/workflows/components/workflow-information';
import { WorkflowLayout as WorkflowLayoutUI } from '@/domains/workflows/components/workflow-layout';
import { WorkflowPageTabs, type WorkflowPageTab } from '@/domains/workflows/components/workflow-page-tabs';
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

/** Shadows the global "go to" sequences with workflow-scoped targets while a workflow page is mounted. */
const WorkflowShortcuts = ({ workflowId }: { workflowId: string }) => {
  const navigate = useNavigate();
  useKeydown({ 'g$+t': () => navigate(`/workflows/${workflowId}/traces`) });
  return null;
};

function WorkflowRoute({ children }: { children: React.ReactNode }) {
  const { workflowId, runId } = useParams();
  const location = useLocation();
  const { isLoading: isWorkflowLoading } = useWorkflow(workflowId);
  const { hasObservability } = useHasObservability();

  const activeTab: WorkflowPageTab | 'none' = location.pathname.includes('/graph')
    ? 'graph'
    : location.pathname.includes('/traces')
      ? 'traces'
      : location.pathname.includes('/schedules')
        ? 'schedules'
        : 'none';
  const crumbs: CrumbDef[] = [
    navCrumb('/workflows'),
    // The `to` link only renders on the nested graph/:runId route.
    runId ? { ...workflowCrumb, to: `/workflows/${encodeURIComponent(workflowId ?? '')}/graph` } : workflowCrumb,
    ...(runId ? [{ id: 'workflow-run', Component: WorkflowRunCrumb, Action: WorkflowRunCopyAction }] : []),
  ];

  if (!workflowId) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{workflowId}</h1>
        <div className="flex h-full flex-col items-center justify-center">
          <Txt variant="body" tone="ink" className="text-center">
            No workflow ID provided
          </Txt>
        </div>
      </PageLayout>
    );
  }

  if (isWorkflowLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">{workflowId}</h1>
        <Skeleton className="h-full" />
      </PageLayout>
    );
  }

  const page = (content: React.ReactNode) => (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} headerActions={<WorkflowHeader />}>
      <h1 className="sr-only">{workflowId}</h1>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <WorkflowPageTabs workflowId={workflowId} activeTab={activeTab} showObservability={hasObservability} />
        {content}
      </div>
    </PageLayout>
  );

  return (
    <TracingSettingsProvider entityId={workflowId} entityType="workflow">
      <SchemaRequestContextProvider>
        <KeyboardScope>
          <WorkflowShortcuts workflowId={workflowId} />
          {activeTab === 'graph' ? (
            <WorkflowStepDetailProvider key={workflowId}>
              <WorkflowRunProvider workflowId={workflowId} initialRunId={runId}>
                <WorkflowSelectedStepProvider>
                  {page(
                    <WorkflowLayoutUI leftSlot={<WorkflowInformation workflowId={workflowId} initialRunId={runId} />}>
                      {children}
                    </WorkflowLayoutUI>,
                  )}
                </WorkflowSelectedStepProvider>
              </WorkflowRunProvider>
            </WorkflowStepDetailProvider>
          ) : (
            page(children)
          )}
        </KeyboardScope>
      </SchemaRequestContextProvider>
    </TracingSettingsProvider>
  );
}
