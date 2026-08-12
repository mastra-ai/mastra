import { useRef } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

import type { PrepareProgress } from '../../workspaces/services/github';
import { useChatSessionContext } from '../context/useChatSessionContext';

/**
 * Canonical ordered phases of `/ensure` — mirror of the SSE contract in
 * `ensureRepoMaterialized` (see `workspaces/services/github.ts`). `done` is
 * the completion signal that unmounts the loader; `reattaching` and
 * `provisioning` are mutually exclusive.
 */
const PHASE_ORDER: PrepareProgress['phase'][] = [
  'reattaching',
  'provisioning',
  'preparing-workspace',
  'cloning',
  'pulling',
  'finalizing',
];

const PHASE_LABEL: Record<PrepareProgress['phase'], string> = {
  reattaching: 'Reattaching to sandbox',
  provisioning: 'Provisioning sandbox',
  'preparing-workspace': 'Preparing workspace',
  cloning: 'Cloning repository',
  pulling: 'Fetching latest changes',
  finalizing: 'Finalizing session',
  done: 'Done',
};

type StepStatus = 'pending' | 'active' | 'complete' | 'skipped';

/**
 * Step loader shown in the transcript region while `/ensure` is in flight,
 * driven by the SSE progress phase in `ChatSessionContext.sandboxProgress`.
 * See "Step loader spec" in the plan for the phase-to-status rules.
 */
export function SessionPrepareSteps() {
  const { sandboxProgress } = useChatSessionContext();
  const observed = sandboxProgress?.phase;
  // Before any event arrives, mark `reattaching` as the active step with a
  // generic "Starting…" message so the loader isn't visually empty.
  const activePhase: PrepareProgress['phase'] = observed ?? 'reattaching';
  const activeMessage = sandboxProgress?.message ?? 'Starting…';
  // Track "we ever saw reattaching" so `provisioning` stays consistently
  // skipped even after the server advances past `reattaching`. Without this,
  // `provisioning` would flip strikethrough → check-mark as later phases
  // arrive, which reads as "provisioning ran".
  const sawReattachingRef = useRef(false);
  if (observed === 'reattaching') sawReattachingRef.current = true;
  const sawReattaching = sawReattachingRef.current;

  return (
    <div
      role="status"
      aria-label="Preparing session"
      className="flex flex-col gap-2"
      data-testid="session-prepare-steps"
    >
      {PHASE_ORDER.map(phase => {
        const status = stepStatus(phase, activePhase, sawReattaching);
        return (
          <SessionPrepareStep
            key={phase}
            label={PHASE_LABEL[phase]}
            status={status}
            message={status === 'active' ? activeMessage : undefined}
          />
        );
      })}
    </div>
  );
}

function stepStatus(
  phase: PrepareProgress['phase'],
  activePhase: PrepareProgress['phase'],
  sawReattaching: boolean,
): StepStatus {
  // `provisioning` is skipped for the whole ensure cycle once `reattaching`
  // has been observed — even after the server advances past it.
  if (sawReattaching && phase === 'provisioning') return 'skipped';
  const activeIdx = PHASE_ORDER.indexOf(activePhase);
  const phaseIdx = PHASE_ORDER.indexOf(phase);
  if (phaseIdx < activeIdx) return 'complete';
  if (phaseIdx === activeIdx) return 'active';
  return 'pending';
}

function SessionPrepareStep({ label, status, message }: { label: string; status: StepStatus; message?: string }) {
  return (
    <div className="flex items-start gap-3" data-status={status} data-testid={`session-prepare-step`}>
      <StepIcon status={status} />
      <div className="flex flex-col">
        <span
          className={
            status === 'complete'
              ? 'text-icon-primary text-sm'
              : status === 'active'
                ? 'text-icon-primary text-sm'
                : status === 'skipped'
                  ? 'text-icon-tertiary text-sm line-through'
                  : 'text-icon-tertiary text-sm'
          }
        >
          {label}
        </span>
        {message && <span className="text-icon-secondary text-xs">{message}</span>}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'complete') return <CheckCircle2 className="text-icon-primary mt-0.5 h-4 w-4" aria-hidden />;
  if (status === 'active') return <Loader2 className="text-icon-primary mt-0.5 h-4 w-4 animate-spin" aria-hidden />;
  return <Circle className="text-icon-tertiary mt-0.5 h-4 w-4" aria-hidden />;
}
