import { ProcessStepListItem } from '@mastra/playground-ui/components/Steps';
import type { ProcessStep } from '@mastra/playground-ui/components/Steps';

import type { PrepareProgress } from '../../workspaces/services/github';
import { useChatMessagesInitializing } from '../context/useChatMessagesInitializing';
import { useChatSessionContext } from '../context/useChatSessionContext';

const GROUPS = [
  { id: 'preparing-sandbox', title: 'Preparing sandbox' },
  { id: 'cloning-repository', title: 'Cloning repository' },
  { id: 'starting-session', title: 'Starting session' },
] as const;

type GroupId = (typeof GROUPS)[number]['id'];

const PHASE_TO_GROUP: Record<PrepareProgress['phase'], GroupId> = {
  reattaching: 'preparing-sandbox',
  provisioning: 'preparing-sandbox',
  'preparing-workspace': 'preparing-sandbox',
  cloning: 'cloning-repository',
  pulling: 'cloning-repository',
  finalizing: 'starting-session',
  done: 'starting-session',
};

const PHASE_DESCRIPTION: Record<PrepareProgress['phase'], string> = {
  reattaching: 'Reattaching…',
  provisioning: 'Provisioning…',
  'preparing-workspace': 'Preparing files…',
  cloning: 'Cloning…',
  pulling: 'Fetching updates…',
  finalizing: 'Finalizing…',
  done: 'Starting…',
};

type StepStatus = 'pending' | 'running' | 'success';

function getStepStatus(index: number, activeIndex: number): StepStatus {
  if (index < activeIndex) return 'success';
  if (index === activeIndex) return 'running';
  return 'pending';
}

function getActiveGroup(options: {
  observedGroup: GroupId | undefined;
  sandboxWarming: boolean;
  startingSession: boolean;
}): GroupId {
  // Sandbox progress wins because history loads in parallel with warm-up.
  if (options.observedGroup) return options.observedGroup;
  if (options.sandboxWarming) return 'preparing-sandbox';
  if (options.startingSession) return 'starting-session';
  return 'preparing-sandbox';
}

function getActiveDescription(observedPhase: PrepareProgress['phase'] | undefined, loadingMessages: boolean) {
  if (observedPhase && observedPhase !== 'done') return PHASE_DESCRIPTION[observedPhase];
  if (loadingMessages) return 'Loading messages…';
  return 'Starting…';
}

export function SessionPrepareSteps({
  finishing = false,
  historyInitializing = false,
}: {
  finishing?: boolean;
  historyInitializing?: boolean;
}) {
  const { sandboxPreparing, sandboxProgress, sandboxWarming } = useChatSessionContext();
  const messagesInitializing = useChatMessagesInitializing();

  const observedPhase = sandboxProgress?.phase;
  const observedGroup = observedPhase ? PHASE_TO_GROUP[observedPhase] : undefined;

  const loadingMessages = !sandboxPreparing && messagesInitializing;
  const startingSession = loadingMessages || (!sandboxPreparing && historyInitializing);

  const activeDescription = getActiveDescription(observedPhase, loadingMessages);

  const activeGroup = getActiveGroup({
    observedGroup,
    sandboxWarming: sandboxWarming === true,
    startingSession,
  });
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
