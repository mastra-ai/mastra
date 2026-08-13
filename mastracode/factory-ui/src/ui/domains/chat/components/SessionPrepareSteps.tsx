import { ProcessStepListItem } from '@mastra/playground-ui/components/Steps';
import type { ProcessStep } from '@mastra/playground-ui/components/Steps';

import type { PrepareProgress } from '../../workspaces/services/github';
import { useChatMessagesInitializing } from '../context/ChatSessionProvider';
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

function getActiveGroup(observedGroup: GroupId | undefined, loadingMessages: boolean): GroupId {
  if (loadingMessages) return 'starting-session';
  return observedGroup ?? 'preparing-sandbox';
}

function getStepDescription(status: StepStatus, loadingMessages: boolean, activeDescription: string): string {
  if (status !== 'running') return '';
  if (loadingMessages) return 'Loading messages…';
  return activeDescription;
}

export function SessionPrepareSteps() {
  const { sandboxPreparing, sandboxProgress } = useChatSessionContext();
  const messagesInitializing = useChatMessagesInitializing();

  const observedPhase = sandboxProgress?.phase;
  const observedGroup = observedPhase ? PHASE_TO_GROUP[observedPhase] : undefined;
  const activeDescription = observedPhase ? PHASE_DESCRIPTION[observedPhase] : 'Starting…';

  const loadingMessages = !sandboxPreparing && messagesInitializing;

  const activeGroup = getActiveGroup(observedGroup, loadingMessages);
  const activeIndex = GROUPS.findIndex(group => group.id === activeGroup);

  const items: Array<{ step: ProcessStep; position: number }> = GROUPS.map((group, index) => {
    const status = getStepStatus(index, activeIndex);

    return {
      position: index + 1,
      step: {
        id: group.id,
        title: group.title,
        status,
        isActive: status === 'running',
        description: getStepDescription(status, loadingMessages, activeDescription),
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
