import type { GetWorkflowResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ChevronRight, Plus } from 'lucide-react';
import type { ContextType, ReactNode } from 'react';
import { useEffect, useContext, useState } from 'react';

import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowRunDetail } from '../runs/workflow-run-details';
import { WorkflowRecentRuns } from '../runs/workflow-run-list';
import { WorkflowRunStatusBadge } from '../workflow/workflow-run-header';
import { WorkflowTrigger } from '../workflow/workflow-trigger';
import { panelSurfaceStyle, WorkflowPanelResizeHandle } from './workflow-layout';

import { useWorkflow } from '@/hooks/use-workflows';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowInformationProps {
  workflowId: string;
  initialRunId?: string;
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
  workflow?: GetWorkflowResponse;
  isLoading: boolean;
};

type RunWorkflowSidebarProps = InitialWorkflowSidebarProps & {
  runId: string;
  observeWorkflowStream?: ContextType<typeof WorkflowRunContext>['observeWorkflowStream'];
};

const FLOATING_PANEL_SURFACE = cn(panelSurfaceStyle, 'pointer-events-auto');

function FloatingPanel({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-col', className)}>
      {children}
      <WorkflowPanelResizeHandle />
    </div>
  );
}

function NewWorkflowRunButton({ workflowId, onClick }: { workflowId: string; onClick: () => void }) {
  const { Link, paths } = useLinkComponent();

  return (
    <Button
      render={<Link href={`${paths.workflowLink(workflowId)}/graph`} />}

      variant="ghost"
      size="icon-md"
      tooltip="New workflow run"
      onClick={onClick}
    >
      <Plus />
    </Button>
  );
}

function WorkflowInformationTopSection({
  children,
  workflowId,
  showNewRunButton,
  onNewRun,
}: {
  children: ReactNode;
  workflowId: string;
  showNewRunButton: boolean;
  onNewRun: () => void;
}) {
  const { result } = useContext(WorkflowRunContext);
  const [isOpen, setIsOpen] = useState(true);
  return (
    <FloatingPanel className="max-h-[75%] flex-initial">
      <Collapsible
        render={<section />}
        open={isOpen}
        onOpenChange={setIsOpen}
        data-testid="workflow-information-top-section"
        className={cn(FLOATING_PANEL_SURFACE, 'flex min-h-0 min-w-0 flex-col overflow-hidden')}
      >
        <div className="flex shrink-0 items-center gap-1 pr-2">
          <CollapsibleTrigger className="text-column text-muted-foreground flex min-w-0 flex-1 items-center gap-2 px-4 py-3">
            <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0 motion-reduce:transition-none" />
            <span>Workflow run</span>
            {!isOpen && result?.status && <WorkflowRunStatusBadge status={result.status} />}
          </CollapsibleTrigger>
          {showNewRunButton && (
            <NewWorkflowRunButton
              workflowId={workflowId}
              onClick={() => {
                setIsOpen(true);
                onNewRun();
              }}
            />
          )}
        </div>
        <CollapsibleContent keepMounted fill className="flex min-h-0 flex-col">
          <ScrollArea
            data-testid="workflow-information-top-scroll-area"
            className="border-border1/50 min-h-0 flex-1 border-t"
            viewPortClassName="h-full"
            mask={{ top: false, bottom: false }}
          >
            {children}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </FloatingPanel>
  );
}

function InitialWorkflowSidebar(props: InitialWorkflowSidebarProps) {
  return <WorkflowTrigger {...props} />;
}

function RunWorkflowSidebar({ runId, observeWorkflowStream, ...props }: RunWorkflowSidebarProps) {
  return <WorkflowRunDetail {...props} runId={runId} observeWorkflowStream={observeWorkflowStream} />;
}

function RecentWorkflowRunsSection({ workflowId, activeRunId }: { workflowId: string; activeRunId?: string }) {
  return (
    <FloatingPanel className="mt-auto max-h-[min(35%,280px)] shrink-0">
      <section className={cn(FLOATING_PANEL_SURFACE, 'flex min-h-0 min-w-0 flex-col overflow-hidden')}>
        <WorkflowRecentRuns workflowId={workflowId} runId={activeRunId} />
      </section>
    </FloatingPanel>
  );
}

export function WorkflowInformation({ workflowId, initialRunId }: WorkflowInformationProps) {
  const { data: workflow, isLoading, error } = useWorkflow(workflowId);

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
        className="workflow-information-panel pointer-events-none flex h-full min-h-0 w-full flex-col gap-2 p-2"
      />
    );
  }

  const resetToNewRun = () => {
    clearData();
    setSelectedStepId(null);
  };

  return (
    <div
      data-testid="workflow-information-panel"
      className="workflow-information-panel pointer-events-none flex h-full min-h-0 w-full flex-col gap-2 p-2"
    >
      <WorkflowInformationTopSection
        workflowId={workflowId}
        showNewRunButton={Boolean(activeRunId)}
        onNewRun={resetToNewRun}
      >
        {initialRunId ? (
          <RunWorkflowSidebar {...actionProps} runId={initialRunId} observeWorkflowStream={observeWorkflowStream} />
        ) : (
          <InitialWorkflowSidebar {...actionProps} />
        )}
      </WorkflowInformationTopSection>

      <RecentWorkflowRunsSection workflowId={workflowId} activeRunId={activeRunId} />
    </div>
  );
}
