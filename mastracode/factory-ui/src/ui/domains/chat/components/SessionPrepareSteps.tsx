import { Check } from 'lucide-react';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { PrepareProgress } from '../../workspaces/services/github';
import { useChatMessagesInitializing } from '../context/ChatSessionProvider';
import { useChatSessionContext } from '../context/useChatSessionContext';

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
type GroupId = 'sandbox' | 'clone' | 'starting';

const GROUP_LABEL: Record<GroupId, string> = {
  sandbox: 'Preparing sandbox',
  clone: 'Cloning repository',
  starting: 'Starting session',
};

const PHASE_TO_GROUP: Record<PrepareProgress['phase'], GroupId | 'done'> = {
  reattaching: 'sandbox',
  provisioning: 'sandbox',
  'preparing-workspace': 'sandbox',
  cloning: 'clone',
  pulling: 'clone',
  finalizing: 'starting',
  done: 'done',
};

const GROUP_ORDER: GroupId[] = ['sandbox', 'clone', 'starting'];

type StepStatus = 'pending' | 'running' | 'success';

/**
 * Step loader shown in the transcript region while `/ensure` is in flight,
 * driven by the SSE progress phase in `ChatSessionContext.sandboxProgress`.
 * Also covers the post-ensure, pre-transcript window where the initial
 * thread-messages fetch is still in flight (via the "Starting session" step).
 *
 * The loader fills the transcript viewport and centers so it reads as the
 * primary content of the empty chat, not a footnote.
 */
export function SessionPrepareSteps() {
  const { sandboxPreparing, sandboxProgress } = useChatSessionContext();
  const messagesInitializing = useChatMessagesInitializing();

  const observedPhase = sandboxProgress?.phase;
  const observedGroup: GroupId | undefined =
    observedPhase && observedPhase !== 'done' ? PHASE_TO_GROUP[observedPhase] as GroupId : undefined;
  const activeMessage = sandboxProgress?.message ?? 'Starting…';

  // Once ensure has finished, messages may still be loading — collapse the
  // whole pipeline to "starting session" running so there is no visual dip.
  const loadingMessages = !sandboxPreparing && messagesInitializing;

  // Determine the active group.
  const activeGroup: GroupId = loadingMessages ? 'starting' : (observedGroup ?? 'sandbox');
  const activeIdx = GROUP_ORDER.indexOf(activeGroup);

  const steps = GROUP_ORDER.map((id, idx) => {
    let status: StepStatus;
    if (idx < activeIdx) status = 'success';
    else if (idx === activeIdx) status = 'running';
    else status = 'pending';
    return { id, status, label: GROUP_LABEL[id] };
  });

  return (
    <div
      role="status"
      aria-label="Preparing session"
      data-testid="session-prepare-steps"
      className="flex flex-1 items-center justify-center px-4 py-8"
    >
      <ul className="flex w-full max-w-sm flex-col gap-3">
        {steps.map(step => (
          <li
            key={step.id}
            data-testid="session-prepare-step"
            data-status={step.status}
            className="flex items-center gap-3"
          >
            <StatusIcon status={step.status} />
            <div className="flex min-w-0 flex-col">
              <span
                className={cn('text-sm', {
                  'text-icon6': step.status === 'success',
                  'text-icon6 font-medium': step.status === 'running',
                  'text-icon3': step.status === 'pending',
                })}
              >
                {step.label}
              </span>
              {step.status === 'running' && activeMessage ? (
                <span className="text-icon3 text-xs">{activeMessage}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'success') {
    return (
      <span className="text-accent1 flex size-5 items-center justify-center rounded-full">
        <Check className="size-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="flex size-5 items-center justify-center">
        <Spinner size="sm" />
      </span>
    );
  }
  return (
    <span className="text-icon3 flex size-5 items-center justify-center">
      <span className="size-2 rounded-full bg-current opacity-50" />
    </span>
  );
}
