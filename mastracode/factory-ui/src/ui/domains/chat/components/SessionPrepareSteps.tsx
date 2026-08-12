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
  const reattaching = observed === 'reattaching';

  return (
    <div
      role="status"
      aria-label="Preparing session"
      className="flex flex-col gap-2"
      data-testid="session-prepare-steps"
    >
      {PHASE_ORDER.map(phase => {
        const status = stepStatus(phase, activePhase, reattaching);
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
  reattaching: boolean,
): StepStatus {
  if (reattaching && phase === 'provisioning') return 'skipped';
  const activeIdx = PHASE_ORDER.indexOf(activePhase);
  const phaseIdx = PHASE_ORDER.indexOf(phase);
  if (phaseIdx < activeIdx) return 'complete';
  if (phaseIdx === activeIdx) return 'active';
  return 'pending';
}

function SessionPrepareStep({
  label,
  status,
  message,
}: {
  label: string;
  status: StepStatus;
  message?: string;
}) {
  return (
    <div className="flex items-start gap-3" data-status={status} data-testid={`session-prepare-step`}>
      <StepIcon status={status} />
      <div className="flex flex-col">
        <span
          className={
            status === 'complete'
              ? 'text-sm text-icon-primary'
              : status === 'active'
                ? 'text-sm text-icon-primary'
                : status === 'skipped'
                  ? 'text-sm text-icon-tertiary line-through'
                  : 'text-sm text-icon-tertiary'
          }
        >
          {label}
        </span>
        {message && <span className="text-xs text-icon-secondary">{message}</span>}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'complete') return <CheckCircle2 className="mt-0.5 h-4 w-4 text-icon-primary" aria-hidden />;
  if (status === 'active')
    return <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-icon-primary" aria-hidden />;
  return <Circle className="mt-0.5 h-4 w-4 text-icon-tertiary" aria-hidden />;
}
