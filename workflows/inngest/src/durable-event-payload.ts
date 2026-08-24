import type { ActorSignal } from '@mastra/core/auth/ee';
import type { TracingOptions } from '@mastra/core/observability';
import { MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';

/**
 * Single source of truth for the `data` payload of the `workflow.<id>` events
 * that drive durable execution in `@mastra/inngest`.
 *
 * Two independent public surfaces send these events: `InngestRun`
 * (`start`/`startAsync`/`resume`/`timeTravel`) and the durable-agent wrapper
 * built by `createInngestAgent` (`stream`/`resume`). They used to build the
 * payload separately, and the same class of bug shipped repeatedly as a result:
 * a per-call signal was added to one side and silently dropped on the other
 * (`actor` in #19426, `requestContext` in #19223).
 *
 * The builders below exist to make that failure mode structural rather than a
 * matter of remembering. Their argument types are explicit — adding a new
 * per-call signal means adding a field here, which makes every caller that
 * does not supply it visible. Do not widen these args to a passthrough object.
 *
 * Caller-specific concerns (snapshot persistence and rollback, tracing span
 * construction, pubsub subscription ordering, result polling) legitimately
 * differ between the two surfaces and deliberately stay at the call sites.
 */

/** Per-call signals that every durable event carries, regardless of sender. */
interface PerCallSignals {
  /**
   * Actor signal used for FGA checks and tool execution. Always a per-call
   * value: it is supplied fresh on every start and resume and is never read
   * back from a persisted snapshot, so a membership-bypass signal is never
   * written to durable storage. This matches the default engine, which passes
   * `actor: params.actor` on resume (see `packages/core/src/workflows/workflow.ts`
   * `_resume`).
   */
  actor?: ActorSignal;
  /** Whether the run emits per-step output. */
  perStep?: boolean;
}

/**
 * Flatten a `RequestContext` into the plain JSON object the event carries.
 * Absent context serializes to `{}`, never `undefined`.
 */
export function serializeRequestContext(requestContext?: RequestContext<any>): Record<string, any> {
  // `toJSON()` rather than `entries()`: it drops values that cannot survive the
  // JSON round trip through `inngest.send()` (functions, RPC proxies, cyclic
  // references). Passing those through raw makes the send throw.
  const obj = requestContext ? requestContext.toJSON() : {};
  // Never hand the framework-managed bearer token to `inngest.send()`: Inngest
  // durably retains and displays event payloads, so a live token would land in
  // third-party storage on every durable start and resume. A resumed
  // authenticated request supplies its own fresh token. Matches
  // `DefaultExecutionEngine.serializeRequestContext`.
  delete obj[MASTRA_AUTH_TOKEN_KEY];
  return obj;
}

/**
 * Resume request-context rule: values persisted in the snapshot are the base,
 * and anything the caller supplies on this resume call overrides them.
 */
export function mergeResumeRequestContext(
  snapshotRequestContext: Record<string, any> | undefined,
  requestContext?: RequestContext<any>,
): Record<string, any> {
  return { ...(snapshotRequestContext ?? {}), ...serializeRequestContext(requestContext) };
}

export function buildDurableTriggerEventData(
  args: PerCallSignals & {
    inputData: any;
    runId: string;
    resourceId?: string;
    /** Already-serialized request context, or a `RequestContext` to serialize. */
    requestContext?: RequestContext<any> | Record<string, any>;
    initialState?: any;
    outputOptions?: Record<string, any>;
    tracingOptions?: TracingOptions;
    format?: string;
    workflowId?: string;
  },
): Record<string, any> {
  const { requestContext, ...rest } = args;
  return {
    ...rest,
    requestContext: toRequestContextEntries(requestContext),
  };
}

export function buildDurableResumeEventData(
  args: PerCallSignals & {
    inputData: any;
    runId: string;
    resourceId?: string;
    /**
     * Already merged via `mergeResumeRequestContext`, or a `RequestContext`
     * when there is no snapshot context to merge with.
     */
    requestContext?: RequestContext<any> | Record<string, any>;
    resume: {
      steps: string[];
      resumePayload: any;
      resumePath?: any;
    };
    tracingOptions?: TracingOptions;
    workflowId?: string;
  },
): Record<string, any> {
  const { requestContext, ...rest } = args;
  return {
    ...rest,
    requestContext: toRequestContextEntries(requestContext),
  };
}

export function buildDurableTimeTravelEventData(
  args: PerCallSignals & {
    runId: string;
    workflowId: string;
    initialState?: any;
    stepResults?: any;
    timeTravel: any;
    requestContext?: RequestContext<any> | Record<string, any>;
    outputOptions?: Record<string, any>;
    tracingOptions?: TracingOptions;
  },
): Record<string, any> {
  const { requestContext, ...rest } = args;
  return {
    ...rest,
    requestContext: toRequestContextEntries(requestContext),
  };
}

function toRequestContextEntries(requestContext?: RequestContext<any> | Record<string, any>): Record<string, any> {
  if (!requestContext) return {};
  // Probe `toJSON`, the method `serializeRequestContext` actually calls, so the
  // check stays aligned with the branch it guards.
  return typeof (requestContext as RequestContext<any>).toJSON === 'function'
    ? serializeRequestContext(requestContext as RequestContext<any>)
    : (requestContext as Record<string, any>);
}
