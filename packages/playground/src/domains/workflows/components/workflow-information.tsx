import type { GetWorkflowResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ChevronRight, Plus } from 'lucide-react';
import type { ContextType, ReactNode } from 'react';
import { useEffect, useContext, useState } from 'react';

import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { WorkflowPanelEdgesContext } from '../context/workflow-panel-edges-context';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowRunDetail } from '../runs/workflow-run-details';
import { WorkflowRecentRuns } from '../runs/workflow-run-list';
import { WorkflowRunStatusBadge } from '../workflow/workflow-run-header';
import { WorkflowTrigger } from '../workflow/workflow-trigger';

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
  | 'streamResult'
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
  observeWorkflowStream?: ({
    workflowId,
    runId,
    storeRunResult,
  }: {
    workflowId: string;
    runId: string;
    storeRunResult: WorkflowRunStreamResult | null;
  }) => void;
};

function NewWorkflowRunButton({ workflowId, onClick }: { workflowId: string; onClick: () => void }) {
  const { Link, paths } = useLinkComponent();

  return (
    <Button
      as={Link}
      href={`${paths.workflowLink(workflowId)}/graph`}
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
  const panelEdges = useContext(WorkflowPanelEdgesContext);
  const { result } = useContext(WorkflowRunContext);
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Collapsible
      render={<section ref={panelEdges?.information} />}
      open={isOpen}
      onOpenChange={setIsOpen}
      data-testid="workflow-information-top-section"
      className="rounded-studio-panel border-border1/50 bg-surface3 flex max-h-[75%] min-h-0 min-w-0 flex-initial flex-col overflow-hidden border"
    >
      <div className="flex shrink-0 items-center gap-1 pr-2">
        <CollapsibleTrigger
          className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-ui-sm font-medium text-neutral4"
          aria-label={isOpen ? 'Collapse workflow run' : 'Expand workflow run'}
        >
          <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral3 motion-reduce:transition-none" />
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
      <CollapsibleContent keepMounted className="flex h-full min-h-0 flex-col" style={{ minHeight: 0 }}>
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
  );
}

function InitialWorkflowSidebar(props: InitialWorkflowSidebarProps) {
  return <WorkflowTrigger {...props} />;
}

function RunWorkflowSidebar({ runId, observeWorkflowStream, ...props }: RunWorkflowSidebarProps) {
  return <WorkflowRunDetail {...props} runId={runId} observeWorkflowStream={observeWorkflowStream} />;
}

function RecentWorkflowRunsSection({ workflowId, activeRunId }: { workflowId: string; activeRunId?: string }) {
  const panelEdges = useContext(WorkflowPanelEdgesContext);
  return (
    <section
      ref={panelEdges?.recentRuns}
      className="workflow-recent-runs rounded-studio-panel border-border1/50 bg-surface3 mt-auto flex max-h-[min(35%,280px)] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border"
    >
      <WorkflowRecentRuns workflowId={workflowId} runId={activeRunId} />
    </section>
  );
}

export function WorkflowInformation({ workflowId, initialRunId }: WorkflowInformationProps) {
  const { data: workflow, isLoading, error } = useWorkflow(workflowId);

  const {
    createWorkflowRun,
    streamWorkflow,
    streamResult,
    isStreamingWorkflow,
    observeWorkflowStream,
    resumeWorkflow,
    cancelWorkflowRun,
    isCancellingWorkflowRun,
    clearData,
    runId: contextRunId,
  } = useContext(WorkflowRunContext);

  const { setSelectedStepId } = useWorkflowSelectedStep();

  const isCurrentRunFinished = ['success', 'failed', 'canceled', 'bailed'].includes(streamResult?.status ?? '');
  const showNewRunButton = Boolean(initialRunId || contextRunId || isStreamingWorkflow) || isCurrentRunFinished;

  const actionProps = {
    workflowId,
    workflow: workflow ?? undefined,
    isLoading,
    createWorkflowRun,
    streamWorkflow,
    resumeWorkflow,
    streamResult,
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
        showNewRunButton={showNewRunButton}
        onNewRun={resetToNewRun}
      >
        {initialRunId ? (
          <RunWorkflowSidebar {...actionProps} runId={initialRunId} observeWorkflowStream={observeWorkflowStream} />
        ) : (
          <InitialWorkflowSidebar {...actionProps} />
        )}
      </WorkflowInformationTopSection>

      <RecentWorkflowRunsSection workflowId={workflowId} activeRunId={initialRunId || contextRunId} />
    </div>
  );
}
