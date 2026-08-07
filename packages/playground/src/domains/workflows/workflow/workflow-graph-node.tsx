import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useState } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import type { Step } from '../context/use-current-run';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import type { WorkflowCardDisplayStatus, WorkflowConditionCodeCondition } from './components/types';
import { WorkflowConditionCardView } from './components/workflow-condition-card-view';
import { WorkflowStepCardView } from './components/workflow-step-card-view';
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

const WorkflowConditionCard = ({ data }: { data: WorkflowStepNodeData }) => {
  const [open, setOpen] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogCondition, setDialogCondition] = useState<WorkflowConditionCodeCondition | undefined>();
  const { steps } = useCurrentRun();
  const conditions = data.conditions ?? [];
  const type = conditions[0]?.type;
  const previousStep = data.previousStepId ? steps[data.previousStepId] : undefined;
  const nextStep = data.nextStepId ? steps[data.nextStepId] : undefined;
  const { displayStatus: previousDisplayStatus, isTripwire } = getDisplayStatus(previousStep);

  return (
    <WorkflowConditionCardView
      type={type}
      conditions={conditions}
      previousDisplayStatus={previousDisplayStatus}
      hasPreviousStep={Boolean(previousStep)}
      hasNextStep={Boolean(nextStep)}
      isOpen={open}
      onOpenChange={setOpen}
      openDialog={openDialog}
      onOpenDialogChange={setOpenDialog}
      dialogCondition={dialogCondition}
      onConditionClick={condition => {
        setDialogCondition(condition);
        setOpenDialog(true);
      }}
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
      <WorkflowConditionCard data={data} />
    ) : (
      <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />
    );

  return (
    <>
      {!data.withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      {content}
      {!data.withoutBottomHandle && (
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
      )}
    </>
  );
}
