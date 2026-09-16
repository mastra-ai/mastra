import { ProcessStepListItem } from '@mastra/playground-ui/components/Steps';
import type { ProcessStep } from '@mastra/playground-ui/components/Steps';

import { useChatMessagesInitializing } from '../context/useChatMessagesInitializing';
import { useChatSessionContext } from '../context/useChatSessionContext';

// Entering a session provisions nothing — sandboxes boot lazily at the first
// command — so the only work worth showing is resolving the session and then
// loading its history.
const GROUPS = [
  { id: 'preparing-session', title: 'Preparing session' },
  { id: 'starting-session', title: 'Starting session' },
] as const;

type GroupId = (typeof GROUPS)[number]['id'];

type StepStatus = 'pending' | 'running' | 'success';

function getStepStatus(index: number, activeIndex: number): StepStatus {
  if (index < activeIndex) return 'success';
  if (index === activeIndex) return 'running';
  return 'pending';
}

export function SessionPrepareSteps({
  finishing = false,
  historyInitializing = false,
}: {
  finishing?: boolean;
  historyInitializing?: boolean;
}) {
  const { sandboxPreparing } = useChatSessionContext();
  const messagesInitializing = useChatMessagesInitializing();

  const loadingMessages = !sandboxPreparing && messagesInitializing;
  const startingSession = loadingMessages || (!sandboxPreparing && historyInitializing);

  const activeDescription = loadingMessages ? 'Loading messages…' : 'Starting…';
  const activeGroup: GroupId = startingSession ? 'starting-session' : 'preparing-session';
  const activeIndex = finishing ? GROUPS.length : GROUPS.findIndex(group => group.id === activeGroup);

  const items: Array<{ step: ProcessStep; position: number }> = GROUPS.map((group, index) => {
    const status = getStepStatus(index, activeIndex);

    return {
      position: index + 1,
      step: {
        id: group.id,
        title: group.title,
        status,
        isActive: status === 'running',
        description: status === 'running' ? activeDescription : '',
      },
    };
  });

  return (
    <div
      role="status"
      aria-label="Preparing session"
      data-testid="session-prepare-steps"
      className="flex flex-1 items-center justify-center px-4 py-8"
    >
      <div className="flex w-full max-w-md flex-col gap-1">
        {items.map(({ step, position }) => (
          <div key={step.id} data-testid="session-prepare-step" data-status={step.status}>
            <ProcessStepListItem step={step} isActive={step.isActive} position={position} variant="plain" />
          </div>
        ))}
      </div>
    </div>
  );
}
