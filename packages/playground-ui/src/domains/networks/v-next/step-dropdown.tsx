import { useEffect, useState } from 'react';
import { useVNextNetworkChat } from '@/services/vnext-network-chat-provider';
import { Button } from '@/ds/components/Button';
import Spinner from '@/components/ui/spinner';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { Clock } from '@/domains/workflows/workflow/workflow-clock';
import { Badge } from '@/ds/components/Badge';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

const LabelMappings = {
  'routing-step': 'Decision making process',
  'agent-step': 'Agent execution',
};

export const StepDropdown = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { executionSteps } = useVNextNetworkChat();

  const latestStepId = executionSteps[executionSteps.length - 1];
  const hasFinished = latestStepId === 'finish';

  return (
    <div className="space-y-2">
      <Button onClick={() => setIsExpanded(!isExpanded)}>
        {hasFinished ? (
          <>
            <Icon>
              <CheckIcon className="text-accent1" />
            </Icon>
            Done
          </>
        ) : (
          <>
            <Icon>
              <Spinner className="animate-spin" />
            </Icon>
            Thinking...
          </>
        )}

        <Icon className="ml-2">
          <ChevronDown className={clsx('transition-transform -rotate-90', isExpanded && 'rotate-0')} />
        </Icon>
      </Button>

      {isExpanded ? <Steps /> : null}
    </div>
  );
};

const Steps = () => {
  const { executionSteps, steps } = useVNextNetworkChat();

  return (
    <ol className="flex flex-col gap-px rounded-lg overflow-hidden">
      {executionSteps.map((stepId: any, index: number) => (
        <StepEntry key={index} stepId={stepId} step={steps[stepId]} />
      ))}
    </ol>
  );
};

const StepEntry = ({ stepId, step }: { stepId: any; step: any }) => {
  const [expanded, setExpanded] = useState(false);
  const stepResult = step['step-result'];

  if (stepId === 'finish') {
    return (
      <div className="bg-surface4 py-2 px-3 text-icon6 flex items-center gap-4 justify-between">
        <Txt variant="ui-sm" className="text-icon6">
          Process completed
        </Txt>
      </div>
    );
  }

  return (
    <li>
      <button
        className="bg-surface4 py-2 px-3 text-icon6 flex items-center gap-4 justify-between w-full text-left"
        onClick={() => setExpanded(s => !s)}
      >
        <div className="flex items-center gap-2">
          <StatusIcon status={stepResult ? stepResult?.status : 'loading'} />
          <Txt variant="ui-sm" className="text-icon6">
            {LabelMappings[stepId as keyof typeof LabelMappings] || stepId}
          </Txt>
        </div>

        {step.metadata?.startTime && <StepClock step={step} />}
      </button>

      {stepId === 'routing-step' && expanded && (
        <div className="bg-surface1 p-3 space-y-4">
          <div>
            <Txt variant="ui-sm" className="text-icon3 font-medium">
              Selection reason:
            </Txt>

            <Txt variant="ui-sm" className="text-icon6">
              {stepResult?.output?.selectionReason || 'N/A'}
            </Txt>
          </div>

          <div>
            <Txt variant="ui-sm" className="text-icon3 font-medium">
              Agent ID
            </Txt>

            <Txt variant="ui-sm" className="text-icon6">
              {stepResult?.output?.resourceId || 'N/A'}
            </Txt>
          </div>
        </div>
      )}
    </li>
  );
};

const StatusIcon = ({ status }: { status: 'error' | 'success' | 'loading' }) => {
  if (status === 'error') {
    return (
      <Icon>
        <CrossIcon className="text-accent2" />
      </Icon>
    );
  }

  if (status === 'success') {
    return (
      <Icon>
        <CheckIcon className="text-accent1" />
      </Icon>
    );
  }

  return (
    <Icon>
      <Spinner className="animate-spin" />
    </Icon>
  );
};

const StepClock = ({ step }: { step: any }) => {
  return (
    <Badge>
      <Clock startedAt={step.metadata.startTime} endedAt={step.metadata?.endTime} />
    </Badge>
  );
};
