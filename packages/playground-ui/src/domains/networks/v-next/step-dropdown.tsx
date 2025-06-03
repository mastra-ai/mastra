import { useState } from 'react';
import { useVNextNetworkChat } from '@/services/vnext-network-chat-provider';
import { Button } from '@/ds/components/Button';

export const StepDropdown = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { executionSteps, steps, allSteps } = useVNextNetworkChat();

  const latestStepId = executionSteps[executionSteps.length - 1];

  const latestStep = steps[latestStepId];

  // const formattedSteps = executionSteps.map(step => {
  //   return {
  //     type: step.type,
  //     payload: step.payload,
  //   };
  // });

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={() => setIsExpanded(!isExpanded)}>
        {latestStep?.type === 'finish' ? 'Done' : 'Thinking...'}
      </Button>
      {isExpanded ? (
        <>
          <div className="flex flex-col gap-2">
            <div>Steps</div>
            <code className="mt-2">{JSON.stringify(steps, null, 2)}</code>
          </div>
          <div className="flex flex-col gap-2">
            <div>All Steps</div>
            <code className="mt-2">{JSON.stringify(allSteps, null, 2)}</code>
          </div>
        </>
      ) : null}
    </div>
  );
};
