import type { WorkflowCardDisplayStatus } from '@mastra/playground-ui/components/Workflow';
import {
  WorkflowNodeFrame,
  WorkflowConditionCard,
  WorkflowStepCardView,
} from '@mastra/playground-ui/components/Workflow';

import type { NodeProps } from '@xyflow/react';

import { useCurrentRun } from '../context/use-current-run';
import type { Step } from '../context/use-current-run';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { useWaitingStepKey } from './use-workflow-trigger';
import { WorkflowStepActionBar } from './workflow-step-action-bar';
import type { WorkflowStepNode, WorkflowStepNodeData } from './workflow-step-node-utils';

export interface WorkflowGraphNodeProps {
  parentWorkflowName?: string;
  stepsFlow: Record<string, string[]>;
}

const getDisplayStatus = (step?: Step): { displayStatus: WorkflowCardDisplayStatus; isTripwire: boolean } => {
  const isTripwire = step?.status === 'failed' && step?.tripwire !== undefined;
  return {
    displayStatus: isTripwire ? 'tripwire' : step?.status,
    isTripwire,
  };
};

const WorkflowStepCard = ({
  data,
  parentWorkflowName,
  stepsFlow,
}: {
  data: WorkflowStepNodeData;
  parentWorkflowName?: string;
  stepsFlow: Record<string, string[]>;
}) => {
  const { steps } = useCurrentRun();
  const { selectedStepId, hoverStepId, setHoverStepId } = useWorkflowSelectedStep();
  const { showNestedGraph } = useWorkflowStepDetail();
  const waitingStepKey = useWaitingStepKey();
  const { label, stepId, description } = data;
  const mapConfig = data.mapConfig ?? ('step' in data.workflowStep ? data.workflowStep.step?.mapConfig : undefined);
  const stepGraph =
    data.stepGraph ??
    ('step' in data.workflowStep ? data.workflowStep.step?.serializedStepFlow : undefined) ??
    (data.workflowStep.kind === 'nested-workflow-step' && data.workflowStep.flow.type === 'workflow'
      ? data.workflowStep.flow.serializedStepFlow
      : undefined);
  const fullLabel = parentWorkflowName ? `${parentWorkflowName}.${label}` : label;
  const stepKey = parentWorkflowName ? `${parentWorkflowName}.${stepId || label}` : stepId || label;
  const isSelected = selectedStepId === stepKey;
  const isWaiting = waitingStepKey === stepKey;
  const isHovered = hoverStepId === stepKey;
  const step = steps[stepKey];
  const { displayStatus, isTripwire } = getDisplayStatus(step);

  return (
    <WorkflowStepCardView
      label={label}
      description={description}
      displayStatus={displayStatus}
      hasStep={Boolean(step)}
      isNestedWorkflowStep={data.workflowStep.kind === 'nested-workflow-step'}
      stepKey={stepKey}
      isSelected={isSelected}
      isWaiting={isWaiting}
      isHovered={isHovered}
      onHoverChange={isHovered => setHoverStepId(isHovered ? stepKey : null)}
      duration={data.duration}
      date={data.date}
      isForEach={data.isForEach}
      foreachProgress={step?.foreachProgress}
      mapConfig={mapConfig}
      canSuspend={data.canSuspend}
      isParallel={data.isParallel}
      stepGraph={stepGraph}
      startedAt={step?.startedAt}
      endedAt={step?.endedAt}
      actionBar={
        <WorkflowStepActionBar
          stepName={label}
          stepId={stepId}
          resumeData={step?.resumeData}
          error={isTripwire ? undefined : step?.error}
          tripwire={isTripwire ? step?.tripwire : undefined}
          mapConfig={mapConfig}
          onShowNestedGraph={stepGraph ? () => showNestedGraph({ label, fullStep: fullLabel, stepGraph }) : undefined}
          status={displayStatus}
          stepKey={stepKey}
          stepsFlow={stepsFlow}
        />
      }
    />
  );
};

const WorkflowConditionNodeCard = ({ data }: { data: WorkflowStepNodeData }) => {
  const { steps } = useCurrentRun();
  const conditions = data.conditions ?? [];
  const previousStep = data.previousStepId ? steps[data.previousStepId] : undefined;
  const nextStep = data.nextStepId ? steps[data.nextStepId] : undefined;
  const { displayStatus: previousDisplayStatus, isTripwire } = getDisplayStatus(previousStep);

  return (
    <WorkflowConditionCard
      conditions={conditions}
      previousDisplayStatus={previousDisplayStatus}
      actionBar={
        <WorkflowStepActionBar
          stepName={data.nextStepId ?? data.label}
          mapConfig={data.mapConfig}
          tripwire={isTripwire ? previousStep?.tripwire : undefined}
          status={nextStep ? previousDisplayStatus : undefined}
        />
      }
    />
  );
};

export function WorkflowGraphNode({
  data,
  parentWorkflowName,
  stepsFlow,
}: NodeProps<WorkflowStepNode> & WorkflowGraphNodeProps) {
  const content =
    data.workflowStep.kind === 'conditional' ? (
      <WorkflowConditionNodeCard data={data} />
    ) : (
      <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />
    );

  return (
    <WorkflowNodeFrame withoutTopHandle={data.withoutTopHandle} withoutBottomHandle={data.withoutBottomHandle}>
      {content}
    </WorkflowNodeFrame>
  );
}
