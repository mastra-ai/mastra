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

/**
 * Thread messages load in parallel with the `/ensure` warm-up (they are keyed
 * by resourceId, not by a live sandbox), so "messages are loading" must never
 * advance the stepper past sandbox work that is still running: the observed
 * warm-up phase is ground truth, and a warm-up that is in flight but has not
 * emitted its first event yet still pins the first step. Only when no warm-up
 * is running may message loading light up "Starting session".
 */
function getActiveGroup(options: {
  observedGroup: GroupId | undefined;
  sandboxWarming: boolean;
  loadingMessages: boolean;
}): GroupId {
  if (options.observedGroup) return options.observedGroup;
  if (options.sandboxWarming) return 'preparing-sandbox';
  if (options.loadingMessages) return 'starting-session';
  return 'preparing-sandbox';
}

export function SessionPrepareSteps() {
  const { sandboxPreparing, sandboxProgress, sandboxWarming } = useChatSessionContext();
  const messagesInitializing = useChatMessagesInitializing();

  const observedPhase = sandboxProgress?.phase;
  const observedGroup = observedPhase ? PHASE_TO_GROUP[observedPhase] : undefined;

  const loadingMessages = !sandboxPreparing && messagesInitializing;

  // The sandbox phase description wins while sandbox work is underway; the
  // terminal `done` phase carries no work of its own, so message loading may
  // take over the description there.
  const activeDescription =
    observedPhase && observedPhase !== 'done'
      ? PHASE_DESCRIPTION[observedPhase]
      : loadingMessages
        ? 'Loading messages…'
        : 'Starting…';

  const activeGroup = getActiveGroup({ observedGroup, sandboxWarming: sandboxWarming === true, loadingMessages });
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
