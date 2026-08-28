import type { ActorSignal } from '../../auth/ee';

/**
 * Resolves the FGA `actor` to hand to the agent/tool call a declarative step
 * makes on the author's behalf.
 *
 * Propagation is strictly opt-in: the run's actor is only inherited when it is
 * the object form carrying `propagate: true`. The `true` shorthand never
 * propagates. Step options always win, and an explicit `actor: undefined` in
 * step options is the escape hatch that drops back to user-actor resolution
 * mid-tree.
 */
export function resolveEntryActor(
  stepOptions: Record<string, unknown> | undefined,
  runActor: ActorSignal | undefined,
): ActorSignal | undefined {
  if (stepOptions && 'actor' in stepOptions) {
    return stepOptions.actor as ActorSignal | undefined;
  }

  const propagates = typeof runActor === 'object' && runActor !== null && runActor.propagate === true;
  return propagates ? runActor : undefined;
}
