### 4.5b Session Lifecycle Errors

```ts
class HarnessSubagentDepthExceededError extends Error {
  readonly maxDepth: number;
  readonly attemptedDepth: number;
}

class HarnessLiveSessionLimitError extends Error {
  readonly maxLive: number;
  readonly liveCount: number;
}

class HarnessSessionClosedError extends Error {
  readonly sessionId: string;
}

class HarnessSessionClosingError extends Error {
  readonly sessionId: string;
  readonly closingAt: number;
  readonly closeDeadlineAt: number;
}

class HarnessSessionNotFoundError extends Error {
  readonly sessionId: string;
}

// Thrown by `harness.session({ sessionId, threadId, resourceId })` or the
// corresponding wire session-create route when a caller asks to create or
// hydrate a specific `sessionId` for a `(harnessName, resourceId, threadId)` pair that
// already has a different active session. Harness v1 permits only one active
// owner per Harness/thread/resource pair (§2.2).
class HarnessSessionConflictError extends Error {
  readonly resourceId: string;
  readonly threadId: string;
  readonly requestedSessionId: string;
  readonly activeSessionId: string;
}

// Thrown by `harness.deleteSession(...)` when `force` is absent/false and the
// closed session still has dependent work or descendants that are not terminal.
// The row IDs are diagnostic/audit detail; callers should branch on the error
// class and either retry after cleanup or repeat with `force: true` from an
// operator path.
class HarnessSessionDeleteBlockedError extends Error {
  readonly sessionId: string;
  readonly blockers: Array<{
    source:
      | 'session'
      | 'child_session'
      | 'queue'
      | 'inbox_response'
      | 'channel_binding'
      | 'channel_inbox'
      | 'channel_action'
      | 'channel_outbox'
      | 'wakeup'
      | 'attachment'
      | 'workspace';
    id?: string;
    status?: string;
  }>;
}

// Thrown by `session.useSkill(name, ...)` when `name` matches neither a
// code-registered skill (`HarnessConfig.skills`) nor a workspace-discovered
// skill. See §4.6 for the resolution rules.
class HarnessSkillNotFoundError extends Error {
  readonly skillName: string;
  readonly searchedSources: Array<'code-registered' | 'workspace'>;
}

// Thrown when the harness observes a hydrated session whose row was deleted
// out-of-band (cascade delete, force delete, thread delete, tenant delete).
// Distinct from `HarnessSessionClosedError`: a closed session's row still
// exists; a deleted session's row is gone, all dependent rows are
// terminalized, and provider callbacks past this point cannot create a
// new receipt for the same `(harnessName, resourceId, threadId)`.
class HarnessSessionDeletedError extends Error {
  readonly sessionId: string;
  readonly resourceId?: string;
  readonly threadId?: string;
  readonly cause?:
    | 'cascade'        // descendant deleted as part of an ancestor delete
    | 'force'          // operator/owner ran force delete
    | 'tenant_delete'  // tenant-wide cleanup
    | 'thread_delete'; // `harness.threads.delete(...)` cascade per §5.5
}

// Thrown when a channel binding is closed for its own lifecycle reasons
// (platform integration severed, operator closed the binding) rather than
// because the owning session closed. Sessions may remain active for other
// channels and direct work; binding closure is local to that
// channel/conversation. Cascade closure from session close/delete is
// reported via `HarnessSessionClosedError` / `HarnessSessionDeletedError`,
// not this class.
class HarnessChannelBindingClosedError extends Error {
  readonly harnessName: string;
  readonly channelId: string;
  readonly bindingId: string;
  readonly reason: 'platform_unlinked' | 'operator_closed';
}

// Thrown when a channel outbox row dead-letters because the stored
// operation/mode is no longer deliverable through the configured adapter.
// The binding stays active; only this row is terminal. Different from
// `HarnessChannelBindingClosedError`, which closes the binding.
class HarnessChannelDeliveryUnavailableError extends Error {
  readonly harnessName: string;
  readonly channelId: string;
  readonly outboxItemId?: string;
  readonly bindingId?: string;
  readonly operationKind?: ChannelOutboxOperationKind;
  readonly operationName?: string;
  readonly reason: 'delivery_operation_unavailable';
}

// Thrown when hydration or background-task execution observes that the
// stored runtime dependency identifiers (mode, agent, model, tool,
// MCP binding, workspace provider, executor, completion policy, sandbox
// policy, channel) are missing or have a `runtimeCompatibilityGeneration`
// mismatch versus the current runtime configuration. Distinct from
// `HarnessSessionCorruptError`: the stored row is well-formed; only the
// runtime that was supposed to honor it has drifted. Background-task rows
// without an owning session use `runId`/`backgroundTaskId` instead of
// `sessionId`.
class HarnessRuntimeDriftError extends Error {
  readonly sessionId?: string;
  readonly runId?: string;
  readonly backgroundTaskId?: string;
  readonly missingRefs?: Array<{
    kind:
      | 'mode'
      | 'agent'
      | 'model'
      | 'tool'
      | 'mcp_binding'
      | 'workspace_provider'
      | 'executor'
      | 'completion_policy'
      | 'sandbox_policy'
      | 'channel';
    ref: string;
  }>;
  readonly driftedRefs?: Array<{
    kind:
      | 'mode'
      | 'agent'
      | 'model'
      | 'tool'
      | 'mcp_binding'
      | 'workspace_provider'
      | 'executor'
      | 'completion_policy'
      | 'sandbox_policy'
      | 'channel';
    ref: string;
    expectedGeneration?: string;
    actualGeneration?: string;
  }>;
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
```
