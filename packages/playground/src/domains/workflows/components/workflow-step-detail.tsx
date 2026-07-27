import { Txt } from '@mastra/playground-ui/components/Txt';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { ReactFlowProvider } from '@xyflow/react';
import { List, X } from 'lucide-react';

import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { BADGE_COLORS } from '../workflow/components/workflow-card-badge-utils';
import { CodeDialogContent } from '../workflow/workflow-code-dialog-content';
import { WorkflowNestedGraph } from '../workflow/workflow-nested-graph';

/**
 * Content for the step detail tab panel (Map Config or Nested Workflow)
 */
export function WorkflowStepDetailContent() {
  const { stepDetail, closeStepDetail } = useWorkflowStepDetail();

  if (!stepDetail) {
    return null;
  }

  return (
    <div className="flex h-full flex-col" data-testid="workflow-step-detail-panel">
      {/* Header with title and close button */}
      <div className="border-border1 bg-surface1 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {stepDetail.type === 'map-config' && <List className="h-4 w-4" style={{ color: BADGE_COLORS.map }} />}
          {stepDetail.type === 'nested-graph' && (
            <WorkflowIcon className="h-4 w-4" style={{ color: BADGE_COLORS.workflow }} />
          )}
          <div className="flex flex-col">
            <Txt variant="ui-md" className="text-neutral6 font-medium">
              {stepDetail.type === 'map-config' ? `${stepDetail.stepName} Config` : `${stepDetail.stepName} Workflow`}
            </Txt>
            {stepDetail.type === 'map-config' && stepDetail.stepId && stepDetail.stepId !== stepDetail.stepName && (
              <Txt variant="ui-xs" className="text-neutral3">
                {stepDetail.stepId}
              </Txt>
            )}
          </div>
        </div>
        <button
          onClick={closeStepDetail}
          className="hover:bg-surface3 rounded p-1 transition-colors"
          aria-label="Close"
        >
          <X className="text-neutral3 h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {stepDetail.type === 'map-config' && stepDetail.mapConfig && <CodeDialogContent data={stepDetail.mapConfig} />}
        {stepDetail.type === 'nested-graph' && stepDetail.nestedGraph && (
          <div className="h-full min-h-[400px]">
            <ReactFlowProvider key={`nested-graph-${stepDetail.nestedGraph.fullStep}`}>
              <WorkflowNestedGraph
                stepGraph={stepDetail.nestedGraph.stepGraph}
                open={true}
                workflowName={stepDetail.nestedGraph.fullStep}
              />
            </ReactFlowProvider>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Side panel that surfaces the step detail content (Map Config or Nested Workflow)
 * next to the workflow graph. Renders nothing until a step detail is opened.
 */
export function WorkflowStepDetailPanel() {
  const { stepDetail } = useWorkflowStepDetail();

  if (!stepDetail) {
    return null;
  }

  return (
    <div className="border-border1 bg-surface2 h-full w-[400px] max-w-[45%] shrink-0 border-l">
      <WorkflowStepDetailContent />
    </div>
  );
}
