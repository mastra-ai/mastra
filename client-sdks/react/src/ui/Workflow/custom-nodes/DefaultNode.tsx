import { useState } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { Eye, LogIn, LogOut } from 'lucide-react';
import { StepCard, StepContent, StepHeader, StepStatus, StepTitle } from '../primitives';
import { StepTimer } from '../primitives/StepTimer';
import { StepActions } from '../primitives/StepActions';
import { NestedWorkflowTrigger } from '../primitives/NestedWorkflowTrigger';
import { NestedWorkflowDialog } from '../primitives/NestedWorkflowDialog';
import { IconButton } from '@/ui/IconButton';
import { WorkflowNode } from '../types';
import { getNodeData } from '../utils/get-node-data';
import { StepHandle } from '../primitives/StepHandle';
import { StepMetadata } from '../primitives/StepMetadata';
import { CodeBlock } from '@/ui/Code';
import { Workflow } from '../Workflow';

export const DefaultNode = ({ data }: NodeProps<WorkflowNode>) => {
  const [showNestedDialog, setShowNestedDialog] = useState(false);

  const step = getNodeData(data.step);
  const stepRun = data.stepRun;
  const isSuspended = stepRun?.status === 'suspended';
  const showParentHandle = data.showParentHandle;
  const isParentStepSuccessful = data.isParentStepSuccessful;
  const hasNestedWorkflow = Boolean(data.nestedStepGraph);

  return (
    <>
      <StepMetadata type={data.type}>
        <StepCard status={stepRun?.status ?? 'idle'}>
          <StepHeader>
            <StepStatus />
            <StepTitle>{step.id}</StepTitle>

            {stepRun?.startedAt && !isSuspended && (
              <StepTimer
                startTime={stepRun.startedAt}
                endedAt={stepRun?.status === 'success' ? stepRun?.endedAt : undefined}
              />
            )}
          </StepHeader>

          <StepContent>{step.description}</StepContent>
          {step.condition && <CodeBlock language="javascript" code={step.condition} />}

          <StepActions>
            {hasNestedWorkflow && <NestedWorkflowTrigger onClick={() => setShowNestedDialog(true)} />}

            <IconButton tooltip="Input">
              <LogIn />
            </IconButton>

            <IconButton tooltip="Output">
              <LogOut />
            </IconButton>

            <IconButton tooltip="Traces">
              <Eye />
            </IconButton>
          </StepActions>

          {!data.isLastStep && (
            <StepHandle type="source" position={Position.Bottom} isFinished={stepRun?.status === 'success'} />
          )}
          {showParentHandle && <StepHandle type="target" position={Position.Top} isFinished={isParentStepSuccessful} />}
        </StepCard>
      </StepMetadata>

      {hasNestedWorkflow && data.nestedStepGraph && (
        <NestedWorkflowDialog open={showNestedDialog} onOpenChange={setShowNestedDialog} title={step.id}>
          <Workflow
            workflow={{ stepGraph: data.nestedStepGraph }}
            workflowResult={data.workflowResult}
            parentStepId={step.id}
          />
        </NestedWorkflowDialog>
      )}
    </>
  );
};
