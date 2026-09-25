import { ErrorBoundary } from '@mastra/playground-ui/components/ErrorBoundary';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { TracingSettingsProvider } from '@mastra/playground-ui/domains/observability/context/tracing-settings-context';
import { WorkflowInformation } from '@mastra/playground-ui/domains/workflows/components/workflow-information';
import { WorkflowLayout as WorkflowLayoutUI } from '@mastra/playground-ui/domains/workflows/components/workflow-layout';
import { WorkflowSelectedStepProvider } from '@mastra/playground-ui/domains/workflows/context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '@mastra/playground-ui/domains/workflows/context/workflow-step-detail-provider';
import { useWorkflow } from '@mastra/playground-ui/domains/workflows/hooks/use-workflow';
import { KeyboardScope } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useMatch, useNavigate, useParams } from 'react-router';
import { WorkflowRunCopyAction, WorkflowRunCrumb } from './workflow-crumbs';
import { WorkflowHeader } from './workflow-header';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { navCrumb, workflowCrumb, type CrumbDef } from '@/domains/navigation/crumbs';
import {
  SchemaRequestContextProvider,
  useMergedRequestContext,
  useSchemaRequestContext,
} from '@/domains/request-context/context/schema-request-context';
import { WorkflowPageTabs, type WorkflowPageTab } from '@/domains/workflows/components/workflow-page-tabs';
import { PlaygroundWorkflowRunProvider } from '@/domains/workflows/playground-workflow-run-provider';
import { usePlaygroundStore } from '@/store/playground-store';

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

const WORKFLOW_PAGE_TABS: readonly WorkflowPageTab[] = ['graph', 'traces', 'schedules'];
const isWorkflowPageTab = (segment: string | undefined): segment is WorkflowPageTab =>
  WORKFLOW_PAGE_TABS.includes(segment as WorkflowPageTab);

/** Shadows the global "go to" sequences with workflow-scoped targets while a workflow page is mounted. */
const WorkflowShortcuts = ({ workflowId }: { workflowId: string }) => {
  const navigate = useNavigate();
  useKeydown({ 'g$+t': () => navigate(`/workflows/${encodeURIComponent(workflowId)}/traces`) });
  return null;
};

function WorkflowRoute({ children }: { children: React.ReactNode }) {
  const { workflowId, runId } = useParams();
  // Match the child segment rather than searching the pathname, so a workflow whose id is
  // itself "traces" or "schedules" doesn't get the wrong tab highlighted.
  const tabMatch = useMatch('/workflows/:workflowId/:tab/*');
  const { isLoading: isWorkflowLoading } = useWorkflow(workflowId, usePlaygroundStore().requestContext);
  const { hasObservability } = useHasObservability();

  const activeTab: WorkflowPageTab | 'none' = isWorkflowPageTab(tabMatch?.params.tab) ? tabMatch.params.tab : 'none';
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
              <PlaygroundWorkflowRunProvider workflowId={workflowId} initialRunId={runId}>
                <WorkflowSelectedStepProvider>
                  {page(
                    <WorkflowLayoutUI
                      leftSlot={<PlaygroundWorkflowInformation workflowId={workflowId} initialRunId={runId} />}
                    >
                      {children}
                    </WorkflowLayoutUI>,
                  )}
                </WorkflowSelectedStepProvider>
              </PlaygroundWorkflowRunProvider>
            </WorkflowStepDetailProvider>
          ) : (
            page(children)
          )}
        </KeyboardScope>
      </SchemaRequestContextProvider>
    </TracingSettingsProvider>
  );
}

function PlaygroundWorkflowInformation({ workflowId, initialRunId }: { workflowId: string; initialRunId?: string }) {
  const requestContext = useMergedRequestContext();
  const { setSchemaValues } = useSchemaRequestContext();
  const { canExecute, canDelete } = usePermissions();

  return (
    <WorkflowInformation
      workflowId={workflowId}
      initialRunId={initialRunId}
      requestContext={requestContext}
      onRequestContextChange={setSchemaValues}
      canExecute={canExecute('workflows')}
      canDelete={canDelete('workflows')}
    />
  );
}
