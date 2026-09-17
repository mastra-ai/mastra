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
  const isInspectingData = stepDetail?.type === 'data';
  const graph = (
    <div className="[container-type:size] relative h-full min-h-0">
      <WorkflowGraph workflowId={workflowId} workflow={workflow} isLoading={isLoading} />
      <WorkflowSuspendedOverlay hidden={isInspectingData} />
      {isInspectingData && (
        <div className="pointer-events-auto absolute top-12 right-2 z-30 flex max-h-[calc(100cqh-64px)] w-[440px] max-w-[calc(100%-16px)] flex-col">
          <WorkflowStepDetailContent />
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
        <WorkflowStepDetailContent />
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
              <div className="rounded-studio-panel border-border1 bg-surface2 pointer-events-auto h-full min-h-0 overflow-hidden border">
                <WorkflowStepDetailContent />
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
  const { data: workflow, isLoading, error } = useWorkflow(workflowId!);

  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="workflows" />
      </div>
    );
  }

  return <WorkflowContent workflowId={workflowId!} workflow={workflow ?? undefined} isLoading={isLoading} />;
};
