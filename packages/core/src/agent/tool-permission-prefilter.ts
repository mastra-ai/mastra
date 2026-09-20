import type { RequestContext } from '../request-context';

export const TOOL_PERMISSION_POLICY_KEY = '__mastra_toolPermissionPolicy';
/**
 * JSON-safe durable marker. It records only that an authoritative policy must
 * be available at the action boundary; it never stores a decision or closure.
 */
export const TOOL_PERMISSION_POLICY_REQUIRED_KEY = '__mastra_toolPermissionPolicyRequired';
/**
 * Trusted assertion that {@link TOOL_PERMISSION_POLICY_KEY} is an immutable
 * per-turn snapshot. Durable foreach execution may use this assertion only to
 * choose a concurrency limit; every tool call still re-evaluates the policy at
 * its side-effect boundary.
 *
 * Callers must not set this for a policy backed by mutable state. Without the
 * assertion, durable execution remains sequential whenever a policy is
 * required so a newly observed `ask` cannot race a sibling side effect.
 */
export const TOOL_PERMISSION_POLICY_STABLE_KEY = '__mastra_toolPermissionPolicyStable';

export type ToolPermissionDecision = 'allow' | 'ask' | 'deny';
export type ToolPermissionPolicy = (toolName: string) => ToolPermissionDecision;

/**
 * Awaited per-tool hook consulted at the action-time gate on every tool call,
 * AFTER the synchronous snapshot policy above resolves. Unlike the snapshot
 * resolver this hook may perform IO (e.g. re-reading a durable grant store)
 * and its decision applies to the specific call about to execute. Throwing
 * or returning an unrecognized decision fails closed as `deny`.
 */
export const ON_BEFORE_TOOL_EXECUTION_KEY = '__mastra_onBeforeToolExecution';
/**
 * JSON-safe durable marker mirroring {@link TOOL_PERMISSION_POLICY_REQUIRED_KEY}:
 * records only that an authoritative `onBeforeToolExecution` hook was threaded
 * for this turn. The hook closure itself never survives transport or cold
 * recovery; when this marker is present without the function, the action-time
 * gate must fail closed as `deny` rather than skip revalidation.
 */
export const ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY = '__mastra_onBeforeToolExecutionRequired';

/**
 * `error.name` marking an action-time authorization denial raised inside a
 * background task attempt. The background-task workflow classifies it as
 * non-retryable by name — `instanceof` does not survive task-context
 * boundaries, and retrying a revoked grant could not succeed anyway.
 */
export const TOOL_PERMISSION_DENIED_ERROR_NAME = 'ToolPermissionDeniedError';

export interface BeforeToolExecutionInput {
  /** Name of the tool about to execute. */
  toolName: string;
  /** Provider tool-call id when known. */
  toolCallId?: string;
  /** Arguments the tool will receive. */
  args?: unknown;
  /** True when this call resumes a parked suspension/approval. */
  isResume?: boolean;
  /**
   * The synchronous snapshot policy's verdict for this tool when the §4.2e
   * gate is engaged — lets the hook skip work when the snapshot already
   * resolves `ask`/`deny` (no grant-derived authorization to revalidate).
   */
  policyDecision?: ToolPermissionDecision;
}

/**
 * Return `'deny'` to block the call through the auditable action-time denied
 * path; `'allow'` or `void` leaves authorization to the normal gates.
 */
export type BeforeToolExecutionHook = (
  input: BeforeToolExecutionInput,
) => 'allow' | 'deny' | void | Promise<'allow' | 'deny' | void>;

const DEFAULT_RUN_KEY = '__default__';
const MAX_RETAINED_RUNS_PER_CONTEXT = 64;
const MAX_RETAINED_DENIED_TOOL_NAMES = 10_000;

const deniedToolNamesByContext = new WeakMap<RequestContext, Map<string, Set<string>>>();

function runKey(runId?: string): string {
  return runId ?? DEFAULT_RUN_KEY;
}

function rememberDeniedToolName(requestContext: RequestContext, runId: string | undefined, toolName: string): void {
  let runs = deniedToolNamesByContext.get(requestContext);
  if (!runs) {
    runs = new Map();
    deniedToolNamesByContext.set(requestContext, runs);
  }

  const key = runKey(runId);
  let names = runs.get(key);
  if (!names) {
    if (runs.size >= MAX_RETAINED_RUNS_PER_CONTEXT) {
      const oldestKey = runs.keys().next().value as string | undefined;
      if (oldestKey !== undefined) runs.delete(oldestKey);
    }
    names = new Set();
    runs.set(key, names);
  }

  if (names.size < MAX_RETAINED_DENIED_TOOL_NAMES) names.add(toolName);
}

/**
 * Returns true when a tool can be omitted before its provider schema and
 * execution wrapper are constructed. This is an optimization only: callers
 * must retain the final pre-provider and action-time permission gates.
 */
export function shouldOmitToolBeforeConversion(
  requestContext: RequestContext,
  runId: string | undefined,
  toolName: string,
): boolean {
  const policy = requestContext.get(TOOL_PERMISSION_POLICY_KEY) as ToolPermissionPolicy | undefined;
  if (typeof policy !== 'function') return false;
  try {
    if (policy(toolName) !== 'deny') return false;
  } catch {
    // The action-time gate treats an unavailable policy as deny. The optional
    // conversion prefilter must fail closed the same way instead of aborting
    // tool-surface construction before the authoritative gate can run.
  }
  rememberDeniedToolName(requestContext, runId, toolName);
  return true;
}

/** Names omitted by the early conversion optimization for this execution. */
export function readPreconvertedDeniedToolNames(
  requestContext: RequestContext | undefined,
  runId: string | undefined,
): readonly string[] {
  if (!requestContext) return [];
  return [...(deniedToolNamesByContext.get(requestContext)?.get(runKey(runId)) ?? [])];
}
