import { useParams } from 'react-router';

import {
  WorkflowRunProvider,
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  useWorkflow,
  WorkflowRunList,
  WorkflowInformation,
  useWorkflowRunExecutionResult,
  Skeleton,
  Txt,
  TracingSettingsProvider,
} from '@mastra/playground-ui';
import { Allotment, LayoutPriority } from 'allotment';
import 'allotment/dist/style.css';

import { WorkflowHeader } from './workflow-header';
import { WorkflowRunState } from '@mastra/core/workflows';
import { useLayoutColumnSizes } from '@/hooks/use-layout-column-sizes';
import { useState } from 'react';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  const { workflowId, runId } = useParams();
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);
  const { data: runExecutionResult } = useWorkflowRunExecutionResult(workflowId ?? '', runId ?? '');
  const { columnSizes, storeColumnSizes } = useLayoutColumnSizes('workflow-layout-sizes');
  const [showFlow, setShowFlow] = useState(false);

  const handleColumnSizesChange = (newSizes: number[]) => {
    storeColumnSizes(newSizes);

    // rendering the flow immediately could cause misalignment issue due to allotment resizing,
    // the flow could not be properly centered in the container
    // to fix the issue we postpone the flow rendering to the next tick after first columns auto-resize
    if (!showFlow) {
      setTimeout(() => {
        setShowFlow(true);
      }, 1);
    }
  };

  if (!workflowId) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
        <MainContentContent isCentered={true}>
          <div className="flex flex-col items-center justify-center h-full">
            <Txt variant="ui-md" className="text-icon6 text-center">
              No workflow ID provided
            </Txt>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  if (isWorkflowLoading) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
      </MainContentLayout>
    );
  }

  const snapshot =
    runExecutionResult && runId
      ? ({
          context: {
            input: runExecutionResult?.payload,
            ...runExecutionResult?.steps,
          } as any,
          status: runExecutionResult?.status,
          result: runExecutionResult?.result,
          error: runExecutionResult?.error,
          runId,
          serializedStepGraph: runExecutionResult?.serializedStepGraph,
        } as WorkflowRunState)
      : undefined;

  return (
    <TracingSettingsProvider entityId={workflowId} entityType="workflow">
      <WorkflowRunProvider snapshot={snapshot} workflowId={workflowId} initialRunId={runId}>
        <MainContentLayout>
          <WorkflowHeader workflowName={workflow?.name || ''} workflowId={workflowId} runId={runId} />
          {columnSizes && (
            <Allotment defaultSizes={columnSizes} onChange={handleColumnSizesChange} className="flex">
              <Allotment.Pane preferredSize={200} minSize={150} maxSize={300}>
                <WorkflowRunList workflowId={workflowId} runId={runId} />
              </Allotment.Pane>

              <Allotment.Pane preferredSize={800} minSize={400} priority={LayoutPriority.High}>
                {showFlow && children}
              </Allotment.Pane>

              <Allotment.Pane preferredSize={500} minSize={300}>
                <WorkflowInformation workflowId={workflowId} initialRunId={runId} />
              </Allotment.Pane>
            </Allotment>
          )}
        </MainContentLayout>
      </WorkflowRunProvider>
    </TracingSettingsProvider>
  );
};
