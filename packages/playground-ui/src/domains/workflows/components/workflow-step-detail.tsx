import { useContext } from 'react';
import { X, List } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';

import { Txt } from '@/ds/components/Txt';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';

import { WorkflowStepDetailContext } from '../context/workflow-step-detail-context';
import { CodeDialogContent } from '../workflow/workflow-code-dialog-content';
import { WorkflowNestedGraph } from '../workflow/workflow-nested-graph';
import { BADGE_COLORS } from '../workflow/workflow-node-badges';

export function WorkflowStepDetail() {
  const { stepDetail, closeStepDetail } = useContext(WorkflowStepDetailContext);

  if (!stepDetail) {
    return null;
  }

  return (
    <div className="flex flex-col border-t-sm border-border1">
      <div className="flex items-center justify-between px-4 py-3 border-b-sm border-border1 bg-surface1">
        <div className="flex items-center gap-2">
          {stepDetail.type === 'map-config' && <List className="w-4 h-4" style={{ color: BADGE_COLORS.map }} />}
          {stepDetail.type === 'nested-graph' && (
            <WorkflowIcon className="w-4 h-4" style={{ color: BADGE_COLORS.workflow }} />
          )}
          <div className="flex flex-col">
            <Txt variant="ui-md" className="text-icon6 font-medium">
              {stepDetail.type === 'map-config'
                ? `${stepDetail.stepName} Map Config`
                : `${stepDetail.stepName} workflow`}
            </Txt>
            {stepDetail.type === 'map-config' && stepDetail.stepId && stepDetail.stepId !== stepDetail.stepName && (
              <Txt variant="ui-xs" className="text-icon3">
                {stepDetail.stepId}
              </Txt>
            )}
          </div>
        </div>
        <button
          onClick={closeStepDetail}
          className="p-1 hover:bg-surface3 rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-icon3" />
        </button>
      </div>

      <div className="overflow-auto">
        {stepDetail.type === 'map-config' && stepDetail.mapConfig && <CodeDialogContent data={stepDetail.mapConfig} />}
        {stepDetail.type === 'nested-graph' && stepDetail.nestedGraph && (
          <div className="h-[400px]">
            <ReactFlowProvider>
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
