### 13.4j Headless and External Process Adapters

**Headless and external process adapters.** Headless CLIs, TUIs, connector
apps, one-shot scripts, and child processes participate in Harness v1 by
choosing a role for each integration boundary. The role is decided by which call
path creates or owns the durable Harness state, not by the binary itself. V1
does not add a generic process event union, process ledger,
`IntegrationInbox`, `IntegrationOutbox`, generic `ActionReceipt`, durable PID
handle, or new Session cancellation API.

- A **session host/controller** creates or opens one or more Harness sessions and
  maps its control loop to `Session` when it runs in-process, or to
  `RemoteSafeSession` when it runs remotely. In-process hosts may use the full
  local `Session` surface plus local-only `Harness` powers such as
  `Harness.subscribe(...)` and `Harness.onInterval(...)`; remote hosts use
  `RemoteSafeSession`, per-session SSE, result lookup by `signalId` /
  `queuedItemId`, and read models. Remote cross-session subscription still does
  not cross the wire (§13.5). After browser reload, controller restart, Harness
  restart, session eviction, auth-token refresh, or SSE `412`, controllers reuse
  the controller recovery rules above. Pending prompts, including subagent
  prompts, are answered through the owning session and `responseId` rules from
  the pending-inbox contract. Existing headless hosts migrate from legacy
  `Harness.sendMessage(...)` / `Harness.subscribe(...)` through the §11.4 method
  translation table.
- A **session-owned tool/process** is work started by a Harness run, tool,
  background task, wakeup, or source-specific row. Its stdin/stdout/stderr,
  progress, status, and exit code are tool effects: they may appear as tool
  output, tool custom events, model-visible output, display diagnostics, or
  source-specific status projections. The child process handle, PID, stream, and
  exit code are not a `Session` and are not a durable recovery boundary. Durable
  completion remains anchored by the owning run, `QueuedItem` /
  `QueueAdmissionReceipt`, `HarnessWakeupItem`, channel inbox/action/outbox row,
  qualified background-task claim contract, or other source-specific row in
  §5.7.
- A **bridge adapter** fronts an external process or protocol only by translating
  it into existing Harness surfaces. It routes input through
  `session.message(...)`, `session.queue(...)`, or `session.useSkill(...)` under
  their existing retry and non-retry-safe rules; routes approvals, questions,
  suspensions, and plans through `PendingInboxItem` plus the `respondTo*`
  methods with `responseId`; exposes output/status through Harness events,
  result lookup, snapshots, and source-specific read models; and keeps subagent
  responses addressed to the `owningSessionId`. A private stdin/stdout stream
  protocol, stdout-scraped approval marker, child-process exit code, or custom
  process event cannot be the source of truth for Harness admission, settlement,
  pending-inbox response, or recovery.

Stop or Cancel, when a headless controller or bridge exposes it, remains an
agent/run-layer or process-local control outside `RemoteSafeSession`. It is not
`session.abort()`, not `session.clearQueue()`, and not session close. If an
agent/run-layer abort interrupts accepted Harness work, unresolved operations
still follow the existing operation-terminality rules (§5.7, §15.1, §15.2).
Process exit codes do not map to Session lifecycle events and do not settle
`message(...)` or `queue(...)` by themselves; they may be rendered as tool return
data, `tool_end.isError`, tool custom events, model output, or diagnostics under
an existing source-specific owner. MCP runtime status, MCP resources, and any
future MCP/app callback receipts remain outside this adapter contract unless a
source-specific ledger is specified.
