import { Spinner } from '@mastra/playground-ui';
import { CheckIcon } from 'lucide-react';
import { CREATION_STEPS, getStepDetail } from './creation-steps';

export type AgentCreationInProgressProps = {
  /**
   * Live per-step status keyed by step id, derived from `streamResult.steps`.
   * Steps absent from this record have not started yet and render as gray. The
   * step's `output` (the accumulated config) drives the dimmer detail line.
   */
  steps: Record<string, { status: string; output?: unknown }>;
};

type StepState = 'success' | 'running' | 'pending';

const resolveStepState = (status: string | undefined): StepState => {
  if (status === 'success') return 'success';
  if (status === 'running' || status === 'waiting') return 'running';
  return 'pending';
};

export const AgentCreationInProgress = ({ steps }: AgentCreationInProgressProps) => {
  return (
    <div className="starter-aurora flex min-h-full flex-col items-center justify-center bg-surface1 px-6 py-24">
      <div
        className="creation-timeline relative z-10 flex w-full max-w-md flex-col gap-8"
        data-testid="agent-creation-in-progress"
      >
        <h1
          className="text-center font-serif text-neutral6"
          style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', lineHeight: 1.1, letterSpacing: '-0.015em' }}
        >
          Building your agent…
        </h1>

        <ol className="flex flex-col">
          {CREATION_STEPS.map((step, idx) => {
            const stepResult = steps[step.id];
            const state = resolveStepState(stepResult?.status);
            const detail = getStepDetail(step.id, stepResult?.output);
            return (
              <li
                key={step.id}
                data-testid={`creation-step-${step.id}`}
                data-status={state}
                className="creation-step flex items-start gap-3 border-b border-border1 py-3 last:border-b-0"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {state === 'success' ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent1Dark shadow-glow-accent1">
                      <CheckIcon className="h-3.5 w-3.5 text-white" />
                    </span>
                  ) : state === 'running' ? (
                    <Spinner />
                  ) : (
                    <span className="mt-1 h-4 w-4 rounded-full border border-dashed border-neutral2" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={
                      state === 'pending'
                        ? 'text-ui-md text-neutral3 transition-colors'
                        : 'text-ui-md text-neutral5 transition-colors'
                    }
                  >
                    {step.label}
                  </span>
                  {detail ? (
                    <span
                      data-testid={`creation-step-${step.id}-detail`}
                      title={detail}
                      className="max-w-full truncate text-ui-sm text-neutral3"
                    >
                      {detail}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
