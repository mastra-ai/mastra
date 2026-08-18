import { createHash } from 'node:crypto';

/**
 * Pulse-owned fact identity — no span context required.
 *
 * A fact id is computed from (runId, surface, base, phase, occurrence),
 * never remembered: a re-executed run mints the SAME ids, so replays stay
 * idempotent under the id-collapsing readers, and any site that knows a
 * fact's logical position can compute its PARENT's id without shared
 * state or ambient context. The flow id for span-less runs is the runId
 * itself — the agent run IS the flow.
 *
 * Phase keys the id (started|ended) rather than the terminal action, so a
 * completed and a failed end address the same logical slot — exactly like
 * spanPulseId on the span lane. `occurrence` is the fact's LOGICAL index
 * within the run (0 for singletons, stepIndex for steps), not arrival
 * order.
 */
export function mintFactId(
  runId: string,
  surface: string,
  base: string,
  phase: 'started' | 'ended',
  occurrence = 0,
): string {
  return `f_${createHash('sha256')
    .update(`${runId}:${surface}:${base}:${phase}:${occurrence}`)
    .digest('hex')
    .slice(0, 32)}`;
}

/** Well-known derivations — the computable spine of the tree. */
export const factIds = {
  run: (runId: string, phase: 'started' | 'ended' = 'started') => mintFactId(runId, 'agent', 'run', phase),
  generation: (runId: string, phase: 'started' | 'ended' = 'started') => mintFactId(runId, 'model', 'generate', phase),
  step: (runId: string, stepIndex: number, phase: 'started' | 'ended' = 'started') =>
    mintFactId(runId, 'model', 'step', phase, stepIndex),
};
