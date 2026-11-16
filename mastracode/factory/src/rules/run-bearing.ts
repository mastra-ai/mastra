/**
 * Decisions that may start or wake an agent run, or wait for one to end, and so
 * hold a run slot. A transition's message is queued as a separate sendMessage,
 * so a transition stays bookkeeping, and so does a status event's route move:
 * it never waits for a run inline, it hands itself back until the run ends.
 */
export const isRunBearingDecision = (decision: Record<string, unknown>): boolean =>
  decision.type === 'invokeSkill' || decision.type === 'sendMessage' || decision.type === 'signalActivity';
