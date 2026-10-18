import type { NodeProps } from '@xyflow/react';

import { useCurrentRun } from '../context/use-current-run';
import type { Step } from '../context/use-current-run';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import { isAwaitingInput, resolveStepSpan } from '../context/workflow-step-timing';
import { useWaitingStepKey } from './use-workflow-trigger';
import { WorkflowBodyGraph } from './workflow-body-graph';
import { getWorkflowCardKind } from './workflow-node-kind';
import { WorkflowStepActionBar } from './workflow-step-action-bar';
import type { WorkflowStepNode, WorkflowStepNodeData } from './workflow-step-node-utils';
import { WorkflowNodeFrame, WorkflowConditionCard, WorkflowStepCardView } from '@/ds/components/Workflow';
import type { WorkflowCardDisplayStatus } from '@/ds/components/Workflow';

export interface WorkflowGraphNodeProps {
  parentWorkflowName?: string;
  stepsFlow: Record<string, string[]>;
  requestContext: Record<string, any>;
}

const getDisplayStatus = (step?: Step): { displayStatus: WorkflowCardDisplayStatus; isTripwire: boolean } => {
  const isTripwire = step?.status === 'failed' && step?.tripwire !== undefined;
  const displayStatus = step && isAwaitingInput(step) ? 'suspended' : step?.status;
  return {
    displayStatus: isTripwire ? 'tripwire' : displayStatus,
    isTripwire,
  };
};

const WorkflowStepCard = ({
  data,
  parentWorkflowName,
  stepsFlow,
  requestContext,
}: {
  data: WorkflowStepNodeData;
  parentWorkflowName?: string;
  stepsFlow: Record<string, string[]>;
  requestContext: Record<string, any>;
}) => {
  const { steps } = useCurrentRun();
  const { selectedStepId, setSelectedStepId, hoverStepId, setHoverStepId } = useWorkflowSelectedStep();
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
  const stepSpan = step ? resolveStepSpan(step) : undefined;

  return (
    <WorkflowStepCardView
      label={data.mapContext?.label ?? label}
      nodeKind={getWorkflowCardKind(data.workflowStep)}
      onSelect={() => setSelectedStepId(stepKey)}
      initiallyOpen={!parentWorkflowName}
      body={
        stepGraph?.length ? (
          <WorkflowBodyGraph
            stepGraph={stepGraph}
            workflowName={fullLabel}
            isForEach={data.isForEach}
            requestContext={requestContext}
          />
        ) : undefined
      }
      description={description ?? data.mapContext?.description}
      displayStatus={displayStatus}
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
      stepGraph={stepGraph}
      startedAt={stepSpan?.start}
      endedAt={stepSpan?.end}
      spansSuspension={stepSpan?.spansSuspension}
      actionBar={
        <WorkflowStepActionBar
          stepName={label}
          stepId={stepId}
          resumeData={step?.resumeData}
          error={isTripwire ? undefined : step?.error}
          tripwire={isTripwire ? step?.tripwire : undefined}
          mapConfig={mapConfig}
          onShowNestedGraph={stepGraph ? () => showNestedGraph({ label, fullStep: fullLabel, stepGraph }) : undefined}
          stepKey={stepKey}
          stepsFlow={stepsFlow}
          requestContext={requestContext}
        />
      }
    />
  );
};

const WorkflowConditionNodeCard = ({
  data,
  parentWorkflowName,
  requestContext,
}: {
  data: WorkflowStepNodeData;
  parentWorkflowName?: string;
  requestContext: Record<string, any>;
}) => {
  const { steps } = useCurrentRun();
  const conditions = data.conditions ?? [];
  const previousStepId =
    data.previousStepId && (parentWorkflowName ? `${parentWorkflowName}.${data.previousStepId}` : data.previousStepId);
  const previousStep = previousStepId ? steps[previousStepId] : undefined;
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
          requestContext={requestContext}
        />
      }
    />
  );
};

export function WorkflowGraphNode({
  data,
  parentWorkflowName,
  stepsFlow,
  requestContext,
}: NodeProps<WorkflowStepNode> & WorkflowGraphNodeProps) {
  const content =
    data.workflowStep.kind === 'conditional' ? (
      <WorkflowConditionNodeCard data={data} parentWorkflowName={parentWorkflowName} requestContext={requestContext} />
    ) : (
      <WorkflowStepCard
        data={data}
        parentWorkflowName={parentWorkflowName}
        stepsFlow={stepsFlow}
        requestContext={requestContext}
      />
    );

  return (
    <WorkflowNodeFrame withoutTopHandle={data.withoutTopHandle} withoutBottomHandle={data.withoutBottomHandle}>
      {content}
    </WorkflowNodeFrame>
  );
}
