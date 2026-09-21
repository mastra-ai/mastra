import { Txt } from '@mastra/playground-ui/components/Txt';
import { BADGE_COLORS, WorkflowCodeContent } from '@mastra/playground-ui/components/Workflow';

import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { ReactFlowProvider } from '@xyflow/react';
import { List, X } from 'lucide-react';

import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { WorkflowDataInspector } from '../workflow/data/workflow-data-inspector';
import { WorkflowNestedGraph } from '../workflow/workflow-nested-graph';

export function WorkflowStepDetailContent() {
  const { stepDetail, closeStepDetail } = useWorkflowStepDetail();

  if (!stepDetail) {
    return null;
  }

  if (stepDetail.type === 'data') return <WorkflowDataInspector selection={stepDetail.selection} />;

  return (
    <div className="flex h-full flex-col" data-testid="workflow-step-detail-panel">
      <div className="border-border bg-sidebar flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {stepDetail.type === 'map-config' && <List className="h-4 w-4" style={{ color: BADGE_COLORS.map }} />}
          {stepDetail.type === 'nested-graph' && (
            <WorkflowIcon className="h-4 w-4" style={{ color: BADGE_COLORS.workflow }} />
          )}
          <div className="flex flex-col">
            <Txt variant="subheading" className="text-foreground">
              {stepDetail.type === 'map-config' ? `${stepDetail.stepName} Config` : `${stepDetail.stepName} Workflow`}
            </Txt>
            {stepDetail.type === 'map-config' && stepDetail.stepId && stepDetail.stepId !== stepDetail.stepName && (
              <Txt variant="meta" className="text-muted-foreground">
                {stepDetail.stepId}
              </Txt>
            )}
          </div>
        </div>
        <button onClick={closeStepDetail} className="hover:bg-fill-subtle rounded p-1" aria-label="Close">
          <X className="text-muted-foreground h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {stepDetail.type === 'map-config' && stepDetail.mapConfig && (
          <WorkflowCodeContent data={stepDetail.mapConfig} />
        )}
        {stepDetail.type === 'nested-graph' && stepDetail.nestedGraph && (
          <div className="h-full min-h-[400px]">
            <ReactFlowProvider key={`nested-graph-${stepDetail.nestedGraph.fullStep}`}>
              <WorkflowNestedGraph
                stepGraph={stepDetail.nestedGraph.stepGraph}
                workflowName={stepDetail.nestedGraph.fullStep}
              />
            </ReactFlowProvider>
          </div>
        )}
      </div>
    </div>
  );
}
