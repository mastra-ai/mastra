import { ProcessStepListItem } from '@mastra/playground-ui/components/Steps';
import type { ProcessStep } from '@mastra/playground-ui/components/Steps';

import type { PrepareProgress } from '../../workspaces/services/github';
import { useChatMessagesInitializing } from '../context/ChatSessionProvider';
import { useChatSessionContext } from '../context/useChatSessionContext';

const GROUP_ORDER = ['preparing-sandbox', 'cloning-repository', 'starting-session'] as const;

type GroupId = (typeof GROUP_ORDER)[number];

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
  const activeIndex = GROUP_ORDER.indexOf(activeGroup);

  const items: Array<{ step: ProcessStep; position: number }> = GROUP_ORDER.map((id, index) => {
    const status = getStepStatus(index, activeIndex);
    const isActive = status === 'running';

    return {
      position: index + 1,
      step: {
        id,
        status,
        isActive,
        title: id,
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
            <ProcessStepListItem
              stepId={step.id}
              step={step}
              isActive={step.isActive}
              position={position}
              variant="plain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
