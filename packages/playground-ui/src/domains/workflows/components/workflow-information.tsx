import type { GetWorkflowResponse } from '@mastra/client-js';
import { useWorkflow } from '@mastra/react/hooks/workflows';
import { Plus } from 'lucide-react';
import type { ContextType, ReactNode } from 'react';
import { useEffect, useContext } from 'react';

import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowRunDetail } from '../runs/workflow-run-details';
import { WorkflowRecentRuns } from '../runs/workflow-run-list';
import { WorkflowTrigger } from '../workflow/workflow-trigger';
import type { WorkflowRunActionsContext } from '../workflow/workflow-trigger';
import { panelSurfaceStyle, WorkflowPanelResizeHandle } from './workflow-layout';

import { Button } from '@/ds/components/Button';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/utils/cn';
import { toast } from '@/utils/toast';

export interface WorkflowInformationProps {
  /** Render flush in a route-owned sidebar instead of floating over the canvas. */
  embedded?: boolean;
  workflowId: string;
  initialRunId?: string;
  requestContext: Record<string, any>;
  runActionsSlot?: (ctx: WorkflowRunActionsContext) => ReactNode;
  canExecute: boolean;
  canDelete: boolean;
}

type WorkflowActionProps = Pick<
  ContextType<typeof WorkflowRunContext>,
  | 'createWorkflowRun'
  | 'streamWorkflow'
  | 'resumeWorkflow'
  | 'isStreamingWorkflow'
  | 'isCancellingWorkflowRun'
  | 'cancelWorkflowRun'
>;

type InitialWorkflowSidebarProps = WorkflowActionProps & {
  workflowId: string;
  requestContext: Record<string, any>;
  runActionsSlot?: (ctx: WorkflowRunActionsContext) => ReactNode;
  runHeaderAction?: ReactNode;
  canExecute: boolean;
  workflow?: GetWorkflowResponse;
  isLoading: boolean;
};

type RunWorkflowSidebarProps = InitialWorkflowSidebarProps & {
  runId: string;
  observeWorkflowStream?: ContextType<typeof WorkflowRunContext>['observeWorkflowStream'];
};

const FLOATING_PANEL_SURFACE = cn(panelSurfaceStyle, 'pointer-events-auto');

function FloatingPanel({
  className,
  children,
  embedded = false,
}: {
  className: string;
  children: ReactNode;
  embedded?: boolean;
}) {
  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-col', className)}>
      {children}
      {!embedded && <WorkflowPanelResizeHandle />}
    </div>
  );
}

function NewWorkflowRunButton({ workflowId, onClick }: { workflowId: string; onClick: () => void }) {
  const { Link, paths } = useLinkComponent();

  return (
    <Button
      render={<Link href={`${paths.workflowLink(workflowId)}/graph`} />}
      variant="ghost"
      size="icon-sm"
      tooltip="New workflow run"
      onClick={onClick}
    >
      <Plus />
    </Button>
  );
}

function WorkflowInformationTopSection({ children, embedded }: { children: ReactNode; embedded: boolean }) {
  return (
    <FloatingPanel embedded={embedded} className={embedded ? 'min-h-0 flex-1' : 'max-h-[75%] flex-initial'}>
      <section
        data-testid="workflow-information-top-section"
        className={cn(
          embedded ? 'pointer-events-auto border-b border-border bg-card' : FLOATING_PANEL_SURFACE,
          'flex min-h-0 min-w-0 flex-col overflow-hidden',
        )}
      >
        <ScrollArea
          data-testid="workflow-information-top-scroll-area"
          className="min-h-0 flex-1"
          mask={{ top: false, bottom: false }}
        >
          <ScrollAreaViewport className="h-full">{children}</ScrollAreaViewport>
        </ScrollArea>
      </section>
    </FloatingPanel>
  );
}

function InitialWorkflowSidebar(props: InitialWorkflowSidebarProps) {
  return <WorkflowTrigger {...props} />;
}

function RunWorkflowSidebar({ runId, observeWorkflowStream, ...props }: RunWorkflowSidebarProps) {
  return <WorkflowRunDetail {...props} runId={runId} observeWorkflowStream={observeWorkflowStream} />;
}

function RecentWorkflowRunsSection({
  workflowId,
  activeRunId,
  canDelete,
  embedded,
}: {
  workflowId: string;
  activeRunId?: string;
  canDelete: boolean;
  embedded: boolean;
}) {
  return (
    <FloatingPanel embedded={embedded} className="mt-auto max-h-[min(35%,280px)] shrink-0">
      <section
        className={cn(
          embedded ? 'pointer-events-auto bg-card' : FLOATING_PANEL_SURFACE,
          'flex min-h-0 min-w-0 flex-col overflow-hidden',
        )}
      >
        <WorkflowRecentRuns workflowId={workflowId} runId={activeRunId} canDelete={canDelete} />
      </section>
    </FloatingPanel>
  );
}

export function WorkflowInformation({
  workflowId,
  initialRunId,
  requestContext,
  runActionsSlot,
  canExecute,
  canDelete,
  embedded = false,
}: WorkflowInformationProps) {
  const {
    data: workflow,
    isLoading,
    error,
  } = useWorkflow({
    workflowId: workflowId,
    requestContext: requestContext,
    queryOptions: { enabled: Boolean(workflowId) },
  });

  const {
    createWorkflowRun,
    streamWorkflow,
    isStreamingWorkflow,
    observeWorkflowStream,
    resumeWorkflow,
    cancelWorkflowRun,
    isCancellingWorkflowRun,
    clearData,
    runId: contextRunId,
  } = useContext(WorkflowRunContext);

  const { setSelectedStepId } = useWorkflowSelectedStep();

  const activeRunId = initialRunId || contextRunId;

  const resetToNewRun = () => {
    clearData();
    setSelectedStepId(null);
  };

  const actionProps = {
    workflowId,
    workflow: workflow ?? undefined,
    isLoading,
    createWorkflowRun,
    streamWorkflow,
    resumeWorkflow,
    isStreamingWorkflow,
    isCancellingWorkflowRun,
    cancelWorkflowRun,
    requestContext,
    runActionsSlot,
    canExecute,
    runHeaderAction: <NewWorkflowRunButton workflowId={workflowId} onClick={resetToNewRun} />,
  };

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load workflow';
      toast.error(`Error loading workflow: ${errorMessage}`);
    }
  }, [error]);

  if (error) {
    return null;
  }

  if (!workflowId) {
    return (
      <div
        data-testid="workflow-information-panel"
        className="workflow-information-panel pointer-events-none flex size-full min-h-0 flex-col gap-2 p-2"
      />
    );
  }

  return (
    <div
      data-testid="workflow-information-panel"
      className={cn(
        'workflow-information-panel flex size-full min-h-0 flex-col',
        !embedded && 'pointer-events-none gap-2 p-2',
      )}
    >
      <WorkflowInformationTopSection embedded={embedded}>
        {initialRunId ? (
          <RunWorkflowSidebar {...actionProps} runId={initialRunId} observeWorkflowStream={observeWorkflowStream} />
        ) : (
          <InitialWorkflowSidebar {...actionProps} />
        )}
      </WorkflowInformationTopSection>

      <RecentWorkflowRunsSection
        workflowId={workflowId}
        activeRunId={activeRunId}
        canDelete={canDelete}
        embedded={embedded}
      />
    </div>
  );
}
