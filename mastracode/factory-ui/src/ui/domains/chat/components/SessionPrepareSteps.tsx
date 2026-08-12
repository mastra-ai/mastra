import { useRef } from 'react';
import { ProcessStepListItem } from '@mastra/playground-ui/components/Steps';
import type { ProcessStep } from '@mastra/playground-ui/components/Steps';

import type { PrepareProgress } from '../../workspaces/services/github';
import { useChatMessagesInitializing } from '../context/ChatSessionProvider';
import { useChatSessionContext } from '../context/useChatSessionContext';

/**
 * Canonical ordered phases of `/ensure` — mirror of the SSE contract in
 * `ensureRepoMaterialized` (see `workspaces/services/github.ts`). `done` is
 * the completion signal that unmounts the loader; `reattaching` and
 * `provisioning` are mutually exclusive — when the server picks `reattaching`
 * we auto-complete `provisioning` as the pipeline advances so the visual
 * pipeline never shows a "crossed-out" step (which reads as failure).
 */
const PHASE_ORDER: PrepareProgress['phase'][] = [
  'reattaching',
  'provisioning',
  'preparing-workspace',
  'cloning',
  'pulling',
  'finalizing',
];

// The `ProcessStepListItem` primitive auto-formats an `id` like
// `preparing-workspace` into the title `Preparing workspace`, so the id
// doubles as the label — no separate label map needed.
const PHASE_ID: Record<PrepareProgress['phase'], string> = {
  reattaching: 'reattaching-to-sandbox',
  provisioning: 'provisioning-sandbox',
  'preparing-workspace': 'preparing-workspace',
  cloning: 'cloning-repository',
  pulling: 'fetching-latest-changes',
  finalizing: 'finalizing-session',
  done: 'done',
};

const LOADING_MESSAGES_ID = 'loading-messages';

type StepStatus = 'pending' | 'running' | 'success';

/**
 * Step loader shown in the transcript region while `/ensure` is in flight,
 * driven by the SSE progress phase in `ChatSessionContext.sandboxProgress`.
 *
 * Also covers the post-ensure, pre-transcript window where the initial
 * thread-messages fetch is still in flight: rendering the same loader (with
 * a "Loading messages" tail step) instead of flipping to skeleton bars keeps
 * the composer's spinning ring continuously meaningful across the whole
 * preparing window.
 *
 * The loader fills the transcript viewport and centers so it reads as the
 * primary content of the empty chat, not a footnote.
 */
export function SessionPrepareSteps() {
  const { sandboxPreparing, sandboxProgress } = useChatSessionContext();
  const messagesInitializing = useChatMessagesInitializing();
  const observed = sandboxProgress?.phase;
  // Before any event arrives, mark `reattaching` as the active step with a
  // generic "Starting…" message so the loader isn't visually empty.
  const activePhase: PrepareProgress['phase'] = observed ?? 'reattaching';
  const activeMessage = sandboxProgress?.message ?? 'Starting…';
  // Track "we ever saw reattaching" so `provisioning` is auto-completed for
  // the rest of the pipeline (server picked reattach → we skip the provision
  // path). Auto-completing (vs. striking through) matches the user's request:
  // when the stepper reaches it, it just visually completes.
  const sawReattachingRef = useRef(false);
  if (observed === 'reattaching') sawReattachingRef.current = true;
  const sawReattaching = sawReattachingRef.current;

  // Once `/ensure` finishes the transcript fetch may still be in flight.
  // Mark every ensure step complete and light up a synthetic tail step.
  const loadingMessages = !sandboxPreparing && messagesInitializing;

  const items: Array<{ step: ProcessStep; position: number }> = PHASE_ORDER.map((phase, idx) => {
    const rawStatus = stepStatus(phase, activePhase, sawReattaching);
    const status: StepStatus = loadingMessages ? 'success' : rawStatus;
    const isActive = status === 'running';
    return {
      position: idx + 1,
      step: {
        id: PHASE_ID[phase],
        status,
        isActive,
        title: PHASE_ID[phase],
        description: isActive ? activeMessage : '',
      },
    };
  });
  items.push({
    position: items.length + 1,
    step: {
      id: LOADING_MESSAGES_ID,
      status: loadingMessages ? 'running' : 'pending',
      isActive: loadingMessages,
      title: LOADING_MESSAGES_ID,
      description: '',
    },
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
            <ProcessStepListItem stepId={step.id} step={step} isActive={step.isActive} position={position} />
          </div>
        ))}
      </div>
    </div>
  );
}

function stepStatus(
  phase: PrepareProgress['phase'],
  activePhase: PrepareProgress['phase'],
  sawReattaching: boolean,
): StepStatus {
  // `provisioning` auto-completes once `reattaching` was observed — the
  // pipeline reached it and just walks past.
  if (sawReattaching && phase === 'provisioning') return 'success';
  const activeIdx = PHASE_ORDER.indexOf(activePhase);
  const phaseIdx = PHASE_ORDER.indexOf(phase);
  if (phaseIdx < activeIdx) return 'success';
  if (phaseIdx === activeIdx) return 'running';
  return 'pending';
}
