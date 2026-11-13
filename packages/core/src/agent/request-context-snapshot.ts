import {
  RequestContext,
  MASTRA_AUTH_TOKEN_KEY,
  MASTRA_INHERITED_MEMORY_KEY,
  MASTRA_VERSIONS_KEY,
  withoutLiveRequestKeys,
} from '../request-context';
import { boundedStringify } from '../utils';
import { restoreRunAgentScopes } from './scopes';

/**
 * Reserved request-context key carrying `Record<runId, DurableExecutionClaim>`.
 * Keyed by runId so a delegated durable sub-agent sharing the parent's
 * RequestContext cannot overwrite the parent's claim.
 */
export const MASTRA_DURABLE_EXECUTIONS_KEY = 'mastra__durableExecutions';

/**
 * JSON-safe snapshot of `requestContext.entries()`, for a run that continues
 * somewhere the live context can't follow: a durable step, or a claimed
 * thread owner in another process. Best-effort: entries that fail a JSON
 * round-trip are skipped so a single non-serializable value can't break the
 * snapshot.
 */
export function snapshotRequestContextEntries(
  requestContext: RequestContext | undefined,
): Record<string, unknown> | undefined {
  if (!requestContext) return undefined;
  const out: Record<string, unknown> = {};
  let any = false;
  for (const [key, value] of requestContext.entries()) {
    // Holds a live MastraMemory instance, which stringifies into a large, method-less
    // husk of the memory and its storage adapter. Persisting that would bloat the
    // workflow input and hand the resumed run an object whose methods are gone; the
    // resumed agent resolves memory from its own config instead.
    if (key === MASTRA_INHERITED_MEMORY_KEY) continue;
    // Framework-managed per-run memory context is rebuilt from persisted run
    // state. A caller may carry a parent run's serializable value here.
    if (key === 'MastraMemory') continue;
    // Never persist the framework-managed bearer token in durable workflow
    // input; a resumed authenticated request supplies its own fresh token.
    if (key === MASTRA_AUTH_TOKEN_KEY) continue;
    // The merged version overrides (Mastra defaults < requestContext <
    // call-site) are framework state written during prep (step 3). Persisting
    // the merged value would freeze the preparing process's defaults over the
    // executing worker's. The caller's own versions entry is re-added at the
    // call site.
    if (key === MASTRA_VERSIONS_KEY) continue;
    // Execution ids are claimed per execution. A persisted id would be restored
    // over a later execution's id (e.g. the recovered one) and fence it out.
    if (key === MASTRA_DURABLE_EXECUTIONS_KEY) continue;
    // Serialize each entry exactly once with a bounded pass: a shared-reference
    // graph would otherwise make JSON.stringify expand exponentially and wedge
    // the event loop on every durable step, and reading the value twice (probe
    // then clone) could disagree if a getter/toJSON is stateful. Entries that
    // produce no JSON (non-serializable, or too large to serialize within
    // budget) are skipped — they wouldn't survive the wire on cross-process
    // engines anyway.
    const json = boundedStringify(value);
    if (json === undefined) continue;
    out[key as string] = JSON.parse(json);
    any = true;
  }
  return any ? out : undefined;
}

/**
 * Restore a RequestContext from a `snapshotRequestContextEntries` snapshot.
 *
 * `entries` is absent on a durable step input even when the run itself has a
 * context: the snapshot is propagated at the run level, not copied onto every
 * step. `runLevel` is that run-level context, which the execution engine has
 * already rebuilt in the step's scope — falling back to it is what keeps
 * request-scoped resolution (tenant/user, workspace, dynamic model/memory)
 * working for tools rebuilt on a cross-process worker, including a delegated
 * subagent's.
 */
export function restoreRequestContext(entries?: Record<string, unknown>, runLevel?: RequestContext): RequestContext {
  if (entries) {
    // The snapshot entries belong to whoever started the run. Their bearer token
    // (legacy snapshots) and signed-in user are dropped, and the live ones are
    // carried over from the run-level context, so a resumed run acts only as
    // the resuming caller. Tools that forward auth (e.g. same-auth MCP servers)
    // keep the live token on paths where the snapshot takes precedence.
    const restored: RequestContext = new RequestContext<unknown>([
      ...Object.entries(withoutLiveRequestKeys(entries)),
      ...liveRequestEntries(runLevel),
    ]);
    restoreRunAgentScopes(restored);
    return restored;
  }
  return runLevel ?? new RequestContext();
}

/** The token and user entries that `withoutLiveRequestKeys` drops, read from the live context. */
export function liveRequestEntries(runLevel?: RequestContext): [string, unknown][] {
  if (!runLevel) return [];
  const live = Object.fromEntries(runLevel.entries());
  const kept = withoutLiveRequestKeys(live);
  return Object.entries(live).filter(([key]) => !(key in kept));
}
