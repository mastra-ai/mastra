### 4.5 Errors

```ts
// Thrown only by fail-fast forms: `message({ output, sync: true })` and
// `useSkill(...)`. Interactive `message()` and `queue()` are busy-independent
// and never throw this error.
class HarnessBusyError extends Error {
  readonly sessionId: string;
  readonly reason: 'in_flight' | 'pending_approval' | 'pending_question' | 'pending_plan';
}

// Thrown by `queue()` when the durable per-session FIFO is at
// `sessions.maxQueueDepth` (§9). The capacity check and the durable append
// are atomic under the session's write lease (§5.8), so two concurrent
// `queue()` calls cannot both observe space and commit past the cap. This
// is intentionally distinct from `HarnessBusyError` — being busy is not a
// reason `queue()` rejects.
class HarnessQueueFullError extends Error {
  readonly sessionId: string;
  readonly maxQueueDepth: number;
  readonly currentDepth: number;
}

// Thrown at admission for malformed options (e.g. `message({ output, stream: true })`,
// negative `maxTurns` on `setGoal`, attachment exceeding `files.maxInlineBytes`).
// Surfaces before any storage write.
class HarnessValidationError extends Error {
  readonly field: string;
  readonly reason: string;
}

// Thrown at admission when `message(...)` carries `model`, `mode`, or
// `addTools` and would drain into an already-active run. The run's surface
// is committed at start time and a mid-flight signal cannot mutate it.
// Caller's options: drop the override and resend, abort the live run and
// resend (the next signal starts a fresh run with the override applied), or
// switch to `session.queue(...)` so the override applies to the queued
// standalone turn. `yolo` is allowed in this case (it gates the next
// approval prompt, not the run surface). See §4.3.
class HarnessOverrideConflictError extends Error {
  readonly sessionId: string;
  readonly activeRunId: string;
  readonly conflictingFields: Array<'model' | 'mode' | 'addTools'>;
}

class HarnessSubagentDepthExceededError extends Error {
  readonly maxDepth: number;
  readonly attemptedDepth: number;
}

class HarnessSessionClosedError extends Error {
  readonly sessionId: string;
}

class HarnessSessionNotFoundError extends Error {
  readonly sessionId: string;
}

// Thrown by `session.useSkill(name, ...)` when `name` matches neither a
// code-registered skill (`HarnessConfig.skills`) nor a workspace-discovered
// skill. See §4.6 for the resolution rules.
class HarnessSkillNotFoundError extends Error {
  readonly skillName: string;
  readonly searchedSources: Array<'code-registered' | 'workspace'>;
}

// The four cancellation sources tools and callers may observe. v1 has no
// `session.abort()` surface (see §3); the run loop's abort signal comes
// from the agent layer, the harness lifecycle, or the parent run.
//
//   'agent_aborted'   — the agent layer cancelled this run: caller invoked
//                       `agent.abort(...)` directly, the run hit its
//                       `maxSteps` ceiling, or the agent surfaced an
//                       internal cancellation. The user/operator wants
//                       this work stopped; tools should run their normal
//                       rollback/cleanup paths.
//
//   'parent_aborted'  — surfaces *only inside subagents*. The parent run's
//                       abort is propagating down. The parent's own
//                       cleanup is going to run regardless, so subagent
//                       tools that maintain external state mostly want to
//                       *skip* side-effect rollback here (the parent will
//                       dominate). Tools that want uniform handling can
//                       coerce this to `agent_aborted` themselves.
//
//   'session_closed'  — `harness.closeSession(...)` (or session lifecycle
//                       teardown) is in progress. The session is going
//                       away; treat this as final, not retryable. No new
//                       turn will land on this session.
//
//   'process_restart' — live in-memory abort propagation when the harness
//                       is shutting down (`harness.shutdown()` or session
//                       eviction under `sessions.maxLive` pressure). This
//                       reason is *only* for the caller/tool that was live
//                       in memory at the moment of teardown. Durable
//                       recovery — pending-approval/suspension resume and
//                       queued-item at-least-once replay across a real
//                       restart — follows §5.7's durable-recovery contract
//                       and never surfaces as `HarnessAbortedError`.
//                       Queued work is *not* the semantic failure of the
//                       queued item; it is paused work that picks up on
//                       the next hydration.
type HarnessAbortReason =
  | 'agent_aborted'
  | 'parent_aborted'
  | 'session_closed'
  | 'process_restart';

class HarnessAbortedError extends Error {
  readonly sessionId: string;
  readonly reason: HarnessAbortReason;
  // For `parent_aborted`, the parent session whose abort propagated here.
  // Absent for the other reasons.
  readonly parentSessionId?: string;
}

// Persistence — see §5.7.
class HarnessStorageError extends Error {
  readonly sessionId: string;
  readonly operation: 'flush' | 'load' | 'attachment';
  readonly cause: unknown;
}

class HarnessSessionCorruptError extends Error {
  readonly sessionId: string;
  readonly reason: 'parse_failed' | 'schema_incompatible';
}

class HarnessStateSerializationError extends Error {
  readonly sessionId: string;
  readonly path: string;          // dotted path into `state` that failed
}

// Workspace provider — see §2.7, §9.
class HarnessConfigError extends Error {
  readonly field: string;         // e.g. 'workspace.provider'
  readonly reason: string;        // e.g. 'provider "X" is not resumable'
}

class HarnessWorkspaceProviderMismatchError extends Error {
  readonly sessionId: string;
  readonly storedProviderId: string;
  readonly configuredProviderId: string;
}

class HarnessWorkspaceLostError extends Error {
  readonly sessionId: string;
  readonly providerId: string;    // the non-resumable provider that owned the workspace
  readonly reason: 'restart' | 'eviction';
}

// Write-concurrency — see §5.8.
class HarnessSessionLockedError extends Error {
  readonly sessionId: string;
  readonly currentOwnerId: string;
  readonly expiresAt: number;     // epoch ms — when the existing lease will TTL out
}
```
