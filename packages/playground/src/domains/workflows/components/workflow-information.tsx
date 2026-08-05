import type { GetWorkflowResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Plus } from 'lucide-react';
import type { ContextType, ReactNode } from 'react';
import { useState, useEffect, useContext } from 'react';

import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowRunDetail } from '../runs/workflow-run-details';
import { WorkflowRecentRuns } from '../runs/workflow-run-list';
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
  setRunId: (runId: string) => void;
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
    <div className="border-border1/50 flex-none border-b px-4 py-4">
      <Button
        as={Link}
        href={`${paths.workflowLink(workflowId)}/graph`}
        variant="primary"
        className="w-full"
        onClick={onClick}
      >
        <Icon>
          <Plus />
        </Icon>
        New workflow run
      </Button>
    </div>
  );
}

function WorkflowInformationTopSection({ children, newRunButton }: { children: ReactNode; newRunButton?: ReactNode }) {
  return (
    <section
      data-testid="workflow-information-top-section"
      className="rounded-studio-panel border-border1/50 bg-surface3 flex max-h-[50%] min-w-0 flex-none flex-col overflow-hidden border"
    >
      {newRunButton}
      <ScrollArea
        data-testid="workflow-information-top-scroll-area"
        className="min-h-0 flex-1"
        viewPortClassName="h-full"
        mask={{ top: false }}
      >
        {children}
      </ScrollArea>
    </section>
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
    <section className="rounded-studio-panel border-border1/50 bg-surface3 min-h-0 min-w-0 flex-1 overflow-hidden border">
      <ScrollArea className="h-full w-full" viewPortClassName="h-full" mask={{ top: false }}>
        <WorkflowRecentRuns workflowId={workflowId} runId={activeRunId} />
      </ScrollArea>
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
    closeStreamsAndReset,
    resumeWorkflow,
    cancelWorkflowRun,
    isCancellingWorkflowRun,
    clearData,
    setRunId: setContextRunId,
    runId: contextRunId,
  } = useContext(WorkflowRunContext);

  const { setSelectedStepId } = useWorkflowSelectedStep();

  const [runId, setRunId] = useState<string>('');

  const isCurrentRunFinished = ['success', 'failed', 'canceled', 'bailed'].includes(streamResult?.status ?? '');
  const showNewRunButton =
    Boolean(initialRunId || runId || contextRunId || isStreamingWorkflow) || isCurrentRunFinished;

  const actionProps = {
    workflowId,
    setRunId,
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
    if (!runId && !initialRunId) {
      closeStreamsAndReset();
    }
  }, [runId, initialRunId, closeStreamsAndReset]);

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
    return <div data-testid="workflow-information-panel" className="flex h-full min-h-0 w-full flex-col gap-2 p-2" />;
  }

  const resetToNewRun = () => {
    closeStreamsAndReset();
    clearData();
    setRunId('');
    setContextRunId('');
    setSelectedStepId(null);
  };

  return (
    <div data-testid="workflow-information-panel" className="flex h-full min-h-0 w-full flex-col gap-2 p-2">
      <WorkflowInformationTopSection
        newRunButton={
          showNewRunButton ? <NewWorkflowRunButton workflowId={workflowId} onClick={resetToNewRun} /> : undefined
        }
      >
        {initialRunId ? (
          <RunWorkflowSidebar {...actionProps} runId={initialRunId} observeWorkflowStream={observeWorkflowStream} />
        ) : (
          <InitialWorkflowSidebar {...actionProps} />
        )}
      </WorkflowInformationTopSection>

      <RecentWorkflowRunsSection workflowId={workflowId} activeRunId={initialRunId || runId || contextRunId} />
    </div>
  );
}
