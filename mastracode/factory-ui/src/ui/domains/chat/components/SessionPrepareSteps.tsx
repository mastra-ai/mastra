import { ProcessStepListItem } from '@mastra/playground-ui/components/Steps';
import type { ProcessStep } from '@mastra/playground-ui/components/Steps';

import type { PrepareProgress } from '../../workspaces/services/github';
import { useChatMessagesInitializing } from '../context/ChatSessionProvider';
import { useChatSessionContext } from '../context/useChatSessionContext';

import './session-prepare-steps.css';

/**
 * User-facing preparation groups. The server emits six granular SSE phases;
 * we roll them up into three coarse steps so the loader reads as an at-a-
 * glance status, not a debug log.
 *
 * Group → SSE phases:
 *  - "Preparing sandbox"    ← reattaching, provisioning, preparing-workspace
 *  - "Cloning repository"   ← cloning, pulling
 *  - "Starting session"     ← finalizing (+ post-ensure messages fetch)
 */
type GroupId = 'preparing-sandbox' | 'cloning-repository' | 'starting-session';

const PHASE_TO_GROUP: Record<PrepareProgress['phase'], GroupId> = {
  reattaching: 'preparing-sandbox',
  provisioning: 'preparing-sandbox',
  'preparing-workspace': 'preparing-sandbox',
  cloning: 'cloning-repository',
  pulling: 'cloning-repository',
  finalizing: 'starting-session',
  done: 'starting-session',
};

const GROUP_ORDER: GroupId[] = ['preparing-sandbox', 'cloning-repository', 'starting-session'];

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

/**
 * Step loader shown in the transcript region while `/ensure` is in flight,
 * driven by the SSE progress phase in `ChatSessionContext.sandboxProgress`.
 * Also covers the post-ensure window where the initial thread-messages
 * fetch is still in flight (surfaced through the "Starting session" step).
 *
 * The loader fills the transcript viewport and centers so it reads as the
 * primary content of the empty chat, not a footnote.
 */
export function SessionPrepareSteps() {
  const { sandboxPreparing, sandboxProgress } = useChatSessionContext();
  const messagesInitializing = useChatMessagesInitializing();

  const observedPhase = sandboxProgress?.phase;
  const observedGroup = observedPhase ? PHASE_TO_GROUP[observedPhase] : undefined;
  const activeDescription = observedPhase ? PHASE_DESCRIPTION[observedPhase] : 'Starting…';

  // Post-ensure but pre-transcript: the sandbox step is done, we're waiting
  // on the initial messages fetch. Collapse the pipeline so "Starting session"
  // is the running step and earlier groups are success.
  const loadingMessages = !sandboxPreparing && messagesInitializing;

  const activeGroup: GroupId = loadingMessages ? 'starting-session' : (observedGroup ?? 'preparing-sandbox');
  const activeIdx = GROUP_ORDER.indexOf(activeGroup);

  const items: Array<{ step: ProcessStep; position: number }> = GROUP_ORDER.map((id, idx) => {
    let status: StepStatus;
    if (idx < activeIdx) status = 'success';
    else if (idx === activeIdx) status = 'running';
    else status = 'pending';
    const isActive = status === 'running';
    return {
      position: idx + 1,
      step: {
        id,
        status,
        isActive,
        title: id,
        description: isActive ? (loadingMessages ? 'Loading messages…' : activeDescription) : '',
      },
    };
  });

  return (
    <div
      role="status"
      aria-label="Preparing session"
      data-testid="session-prepare-steps"
      className="session-prepare-steps flex flex-1 items-center justify-center px-4 py-8 [&_p]:whitespace-nowrap"
    >
      <div className="flex w-full max-w-md flex-col gap-1">
        {items.map(({ step, position }) => (
          <div key={step.id} data-testid="session-prepare-step" data-status={step.status}>
            <ProcessStepListItem stepId={step.id} step={step} isActive={step.isActive} position={position} />
          </div>
        ))}
      </div>
    </div>
  );
}
