import { createDeadlineAbortSignal } from '../../../../loop/timeout';
import type { ExecutionDeadline } from '../../../../loop/timeout';

export type StepLifetime = {
  closed: boolean;
  /**
   * Aborts when the session's run-level budget expires. A cross-process engine hands the deadline
   * to each step through its engine context, since the caller's own timer lives in another process.
   */
  deadlineSignal: AbortSignal | undefined;
};

/** Close on failure too, so retained callbacks never write to an abandoned step. */
export function withStepLifetime<Params extends { engine: unknown }, Result>(
  execute: (params: Params, lifetime: StepLifetime) => Promise<Result>,
) {
  return async (params: Params): Promise<Result> => {
    const deadline = createDeadlineAbortSignal(
      (params.engine as { executionDeadline?: ExecutionDeadline } | undefined)?.executionDeadline,
    );
    const lifetime: StepLifetime = { closed: false, deadlineSignal: deadline.signal };
    try {
      return await execute(params, lifetime);
    } finally {
      lifetime.closed = true;
      deadline.cleanup();
    }
  };
}
