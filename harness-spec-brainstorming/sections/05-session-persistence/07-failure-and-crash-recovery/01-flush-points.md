### 5.7a Flush Points

**Flush points.** Writes to storage happen in two flavours:

- **Durable (commit-on-return transitions).** Queue append, `setState`,
permission grant/revoke/policy changes, harness-authored approval gates plus
tool-context suspension/question/plan registration, goal set/pause/resume/clear,
goal judge receipt plus continuation admission, `currentRun`
start/wait/resume/terminal transitions, mode or model switch, subagent model
switch, `setThreadSetting`, attachment upload, workspace provider recovery-state
updates delivered through `WorkspaceCreateContext.onStateChange` /
`WorkspaceResumeContext.onStateChange`, `closeSession`. These public APIs,
tool-context methods, and provider callbacks are promise-returning (or, for
`suspendTool`, `Promise<never>`): the originating call only resolves or throws
the suspension interrupt once the write is committed. For workspace provider
recovery-state updates, "committed" means `SessionRecord.workspace.state` and
optional `generation` are atomically saved under the owning session lease and
version CAS before the provider treats that state as recoverable. For
`closeSession`, "committed" means the bounded close has reached the terminal
`closedAt` write for the close target; the earlier `closingAt` marker is
observable but is not a successful close return by itself. If validation,
serialization, closing/closed-session, lease, CAS, or storage failure prevents
the commit, the call rejects with the corresponding Harness error and the
in-memory mutation is rolled back so the live `Session` and the persisted record
stay in agreement. Close is the exception after its `closingAt` marker has
already committed: a later terminalization failure leaves the visible Closing
marker and stored `closeDeadlineAt` in place for idempotent retry rather than
rolling the session back to Active. Commit events, display projections, and
goal/permission/pending-item notifications are emitted only after the durable
transition succeeds.
- **Debounced (non-critical).** Token usage, `lastActivityAt`, display-state
snapshots, non-terminal `currentRun.updatedAt` refreshes, periodic OM
bookkeeping. Coalesced on the `sessions.flushDebounceMs` window. Failures are
logged and retried with exponential backoff. After `sessions.maxFlushFailures`
consecutive failures (default `5`), the session emits an `error` event and
starts rejecting durable operations with `HarnessStorageError` until storage
recovers — input is *not* silently buffered in memory.

`setThreadSetting` is durable only for the app-owned `metadata.app` key it
writes. It is serialized under the owning session lease, advances the session
version when committed, preserves unrelated top-level and app metadata, and
does not emit `state_changed` or mutate display/runtime projections. Recovery
never treats `metadata.app` as proof of mode/model, OM config, channel routing,
permission, token usage, or subagent state.
