import type { CreatedAgentSignal } from './signals';

/**
 * Signals waiting for a thread's active run, keyed by thread key.
 */
export function createActiveRunSignalQueues() {
  const pendingSignalsByThread = new Map<string, CreatedAgentSignal[]>();
  // Signals queued for a run that is starting but has not made its first model
  // request yet. The first LLM step drains these and folds them into that
  // request; `pendingSignalsByThread` follow-ups instead become their own turn.
  const preRunSignalsByThread = new Map<string, CreatedAgentSignal[]>();

  return {
    pendingSignalsByThread,
    preRunSignalsByThread,
  };
}

export type ActiveRunSignalQueues = ReturnType<typeof createActiveRunSignalQueues>;
