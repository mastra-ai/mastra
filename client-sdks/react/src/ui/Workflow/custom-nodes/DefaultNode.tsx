import { NodeProps, Position } from '@xyflow/react';
import { StepCard, StepContent, StepHeader, StepStatus, StepTitle } from '../primitives';
import { StepTimer } from '../primitives/StepTimer';
import { StepActions } from '../primitives/StepActions';
import { IconButton } from '@/ui/IconButton';
import { Eye, LogIn, LogOut } from 'lucide-react';
import { WorkflowNode } from '../types';
import { getNodeData } from '../utils/get-node-data';
import { StepHandle } from '../primitives/StepHandle';
import { StepMetadata } from '../primitives/StepMetadata';
import { CodeBlock } from '@/ui/Code';

export const DefaultNode = ({ data }: NodeProps<WorkflowNode>) => {
  const step = getNodeData(data.step);
  const stepRun = data.stepRun;
  const isSuspended = stepRun?.status === 'suspended';
  const showParentHandle = data.showParentHandle;
  const isParentStepSuccessful = data.isParentStepSuccessful;

  return (
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
  );
};
