import type { GetWorkflowResponse } from '@mastra/client-js';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { WorkflowStepDetailContent } from '@mastra/playground-ui/domains/workflows/components/workflow-step-detail';
import { useWorkflowStepDetail } from '@mastra/playground-ui/domains/workflows/context/workflow-step-detail-context';
import { useWorkflow } from '@mastra/playground-ui/domains/workflows/hooks/use-workflow';
import { WorkflowGraph } from '@mastra/playground-ui/domains/workflows/workflow/workflow-graph';
import { WorkflowSuspendedOverlay } from '@mastra/playground-ui/domains/workflows/workflow/workflow-suspended-overlay';
import { WorkflowTimeline } from '@mastra/playground-ui/domains/workflows/workflow/workflow-timeline';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { PanelGroup } from '@mastra/playground-ui/resize/panel-group';
import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { Panel } from 'react-resizable-panels';
import { useParams } from 'react-router';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { usePlaygroundStore } from '@/store/playground-store';

interface WorkflowContentProps {
  workflowId: string;
  workflow?: GetWorkflowResponse;
  isLoading: boolean;
}

const WorkflowContent = ({ workflowId, workflow, isLoading }: WorkflowContentProps) => {
  const requestContext = useMergedRequestContext();
  const { canExecute, isLoading: isLoadingPermissions } = usePermissions();
  const { stepDetail } = useWorkflowStepDetail();
  const isMobile = useIsMobile();
  const isInspectingData = stepDetail?.type === 'data';
  const graph = (
    <div className="[container-type:size] relative h-full min-h-0">
      <WorkflowGraph
        workflowId={workflowId}
        workflow={workflow}
        isLoading={isLoading}
        requestContext={requestContext}
      />
      <WorkflowSuspendedOverlay
        hidden={isInspectingData}
        requestContext={requestContext}
        canResume={!isLoadingPermissions && canExecute('workflows')}
      />
      {isInspectingData && (
        <div className="pointer-events-auto absolute top-12 right-2 z-30 flex max-h-[calc(100cqh-64px)] w-[440px] max-w-[calc(100%-16px)] flex-col">
          <WorkflowStepDetailContent requestContext={requestContext} />
        </div>
      )}
      <div className="pointer-events-none absolute right-0 bottom-0 left-[var(--workflow-left-panel-width,0px)] z-20">
        <WorkflowTimeline />
      </div>
    </div>
  );

  if (isMobile && stepDetail && !isInspectingData) {
    return (
      <div className="h-full min-h-0 overflow-hidden">
        <WorkflowStepDetailContent requestContext={requestContext} />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      {graph}
      <PanelGroup className="pointer-events-none absolute inset-0 z-30 min-h-0 w-full min-w-0 p-2">
        <Panel id="workflow-graph" className="pointer-events-none min-w-0" />
        {stepDetail && !isInspectingData && (
          <>
            <PanelSeparator className="pointer-events-auto" />
            <Panel id="workflow-step-detail" minSize={300} maxSize="60%" defaultSize={420} className="min-w-0">
              <div className="pointer-events-auto h-full min-h-0 overflow-hidden rounded-studio-panel border border-border bg-background">
                <WorkflowStepDetailContent requestContext={requestContext} />
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
};

export const Workflow = () => {
  const { workflowId } = useParams();
  const { data: workflow, isLoading, error } = useWorkflow(workflowId!, usePlaygroundStore().requestContext);

  if (error && is401UnauthorizedError(error)) {
    return <SessionExpired variant="fill" />;
  }

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied variant="fill" resource="workflows" />;
  }

  return <WorkflowContent workflowId={workflowId!} workflow={workflow ?? undefined} isLoading={isLoading} />;
};
