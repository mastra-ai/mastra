import type { GetWorkflowResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
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
  observeWorkflowStream?: ContextType<typeof WorkflowRunContext>['observeWorkflowStream'];
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
  const { result } = useContext(WorkflowRunContext);
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Collapsible
      render={<section />}
      open={isOpen}
      onOpenChange={setIsOpen}
      data-testid="workflow-information-top-section"
      className="rounded-studio-panel border-border1/50 bg-surface3 shadow-panel pointer-events-auto flex max-h-[75%] min-h-0 min-w-0 flex-initial flex-col overflow-hidden border"
    >
      <div className="flex shrink-0 items-center gap-1 pr-2">
        <CollapsibleTrigger className="text-ui-sm text-neutral4 flex min-w-0 flex-1 items-center gap-2 px-4 py-3 font-medium">
          <ChevronRight aria-hidden className="text-neutral3 size-4 shrink-0 motion-reduce:transition-none" />
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
      <CollapsibleContent keepMounted className="flex h-full min-h-0 flex-col">
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
  return (
    <section className="rounded-studio-panel border-border1/50 bg-surface3 shadow-panel pointer-events-auto mt-auto flex max-h-[min(35%,280px)] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border">
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
