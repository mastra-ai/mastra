import type { ActorSignal } from '@mastra/core/auth/ee';
import type { RequestContext } from '@mastra/core/request-context';

/**
 * `InngestRun` (the general Workflow API, see `run.ts`) and `createInngestAgent`
 * (the durable-agent wrapper, see `durable-agent/create-inngest-agent.ts`) both
 * fire the same `workflow.<id>` event directly via `inngest.send()` instead of
 * one delegating to the other. Every per-call trust/context signal that needs
 * to survive the durable boundary (`requestContext`, `actor`) has to be built
 * into the event payload identically in both places, or one path silently
 * drops it — this is exactly what happened with `actor` (missing entirely from
 * createInngestAgent) and `requestContext` (hardcoded to `{}` there, see #19223
 * and #19426/actor). Route any such signal through the helpers below from both
 * call sites so a future addition can't go out of sync the same way.
 */
export interface DurableTriggerSignals<TRequestContext = unknown> {
  requestContext?: RequestContext<TRequestContext> | Record<string, unknown>;
  actor?: ActorSignal;
}

export function serializeRequestContext<TRequestContext = unknown>(
  requestContext?: RequestContext<TRequestContext> | Record<string, unknown>,
): Record<string, unknown> {
  if (!requestContext) return {};
  if (typeof (requestContext as RequestContext<TRequestContext>).entries === 'function') {
    return Object.fromEntries((requestContext as RequestContext<TRequestContext>).entries());
  }
  return requestContext as Record<string, unknown>;
}

/**
 * Build the `requestContext`/`actor` fields for an event that starts a new
 * durable run (or time-travels into one).
 */
export function buildDurableTriggerFields<TRequestContext = unknown>(
  signals: DurableTriggerSignals<TRequestContext>,
): {
  requestContext: Record<string, unknown>;
  actor: ActorSignal | undefined;
} {
  return {
    requestContext: serializeRequestContext(signals.requestContext),
    actor: signals.actor,
  };
}

/**
 * Build the `requestContext`/`actor` fields for an event that resumes a
 * suspended durable run.
 *
 * `requestContext` merges the run's persisted context with any fresh values
 * the caller passes on resume (persisted values lose on key collision) so a
 * resume can both recover prior context and refresh it.
 *
 * `actor` is intentionally NOT read from persisted state — it's a per-call
 * trust signal that must be re-supplied by the caller on every resume, not a
 * membership-bypass signal we persist into durable storage.
 */
export function buildDurableResumeFields<TRequestContext = unknown>(signals: {
  persistedRequestContext?: Record<string, unknown>;
  requestContext?: RequestContext<TRequestContext> | Record<string, unknown>;
  actor?: ActorSignal;
}): {
  requestContext: Record<string, unknown>;
  actor: ActorSignal | undefined;
} {
  return {
    requestContext: {
      ...(signals.persistedRequestContext ?? {}),
      ...serializeRequestContext(signals.requestContext),
    },
    actor: signals.actor,
  };
}
