import type { GetWorkflowResponse } from '@mastra/client-js';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { PanelGroup } from '@mastra/playground-ui/resize/panel-group';
import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { Panel } from 'react-resizable-panels';
import { useParams } from 'react-router';
import { WorkflowStepDetailContent } from '@/domains/workflows/components/workflow-step-detail';
import { useWorkflowStepDetail } from '@/domains/workflows/context/workflow-step-detail-context';
import { WorkflowStepDetailProvider } from '@/domains/workflows/context/workflow-step-detail-provider';
import { WorkflowGraph } from '@/domains/workflows/workflow/workflow-graph';
import { WorkflowSuspendedOverlay } from '@/domains/workflows/workflow/workflow-suspended-overlay';
import { WorkflowTimeline } from '@/domains/workflows/workflow/workflow-timeline';
import { useWorkflow } from '@/hooks/use-workflows';

interface WorkflowContentProps {
  workflowId: string;
  workflow?: GetWorkflowResponse;
  isLoading: boolean;
}

const WorkflowContent = ({ workflowId, workflow, isLoading }: WorkflowContentProps) => {
  const { stepDetail } = useWorkflowStepDetail();
  const isMobile = useIsMobile();
  const graph = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 p-2 pb-0">
        <WorkflowGraph workflowId={workflowId} workflow={workflow} isLoading={isLoading} />
        <WorkflowSuspendedOverlay />
        <WorkflowTimeline />
      </div>
    </div>
  );

  if (isMobile) {
    return stepDetail ? (
      <div className="h-full min-h-0 overflow-hidden">
        <WorkflowStepDetailContent />
      </div>
    ) : (
      graph
    );
  }

  return (
    <PanelGroup className="h-full min-h-0 w-full min-w-0">
      <Panel id="workflow-graph" className="min-w-0">
        {graph}
      </Panel>
      {stepDetail ? (
        <>
          <PanelSeparator />
          <Panel id="workflow-step-detail" minSize={300} maxSize="60%" defaultSize={420} className="min-w-0">
            <div className="border-border1 h-full min-h-0 overflow-hidden border-l">
              <WorkflowStepDetailContent />
            </div>
          </Panel>
        </>
      ) : null}
    </PanelGroup>
  );
};

export const Workflow = () => {
  const { workflowId } = useParams();
  const { data: workflow, isLoading, error } = useWorkflow(workflowId!);

  // 401 check - session expired, needs re-authentication
  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  // 403 check - permission denied for workflows
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="workflows" />
      </div>
    );
  }

  return (
    <WorkflowStepDetailProvider>
      <WorkflowContent workflowId={workflowId!} workflow={workflow ?? undefined} isLoading={isLoading} />
    </WorkflowStepDetailProvider>
  );
};
