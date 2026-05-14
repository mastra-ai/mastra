### 11.5 What's not in v1

These are deferred. Each can be added as an additive feature later without
breaking the v1 contract.

- **Shared / collaborative threads across resources.** Threads are single-tenant
in v1 (§2.3). Two users participating in the same conversation today is built
outside the harness. If we add it later, it'll be an opt-in ACL on the thread
record, not a relaxation of the existing `(harnessName, resourceId, threadId)`
lookup invariant.
- **Detach without close.** `harness.detachSession({ sessionId })` (proactively
flush + drop without setting `closedAt`) — happens implicitly today via eviction
(§5.4). We add an explicit method when a real caller needs it.
- **Nested goals and product-specific goal policy.** A session holds at most
  one durable goal in v1 (§4.7). Spawn a child session if you need a sub-goal.
  Product-specific planners, multi-goal arbitration, alternate judge
  strategies, custom goal dashboards, goal-specific read state, and operator
  policy layers are outside core v1; they build on the single-goal
  `GoalState` / `GoalEvent` contract instead of owning separate goal storage,
  receipt, or lease semantics.
- **Pluggable workspace ACLs.** Workspaces today are owned by the session or
resource that provisioned them (§2.7). Cross-session sharing of a workspace
under a permission model is out of scope.
- **Programmable sandbox command registries and command ACLs.** V1 keeps only
  the optional static workspace/sandbox command-start policy in §7. It does not
  add public `defineCommand` / `getCommands` APIs, executable command handlers,
  per-command environment overrides, per-principal command grants, argument
  validators, or remote registry inspection. Products may wrap their own
  sandbox providers, but closure-backed or product-specific command dispatch is
  not portable Harness recovery state unless a later extension defines its
  ownership, rehydration, and foreground/background process hooks.
- **Cross-instance `'wait'` lock coordination beyond a single storage backend.**
§5.8's lock modes assume the same storage adapter is shared across processes.
Federated storage with cross-region lease coordination is not specified.
- **Multi-server SSE fan-out.** §13 deploys behind a single Mastra Server
process or a sticky-session load balancer. True multi-instance event
subscription waits on Mastra Worker (out of scope here).
- **First-class collaboration semantics on `pendingQueue`.** Items in the queue
assume a single producer (the session's resource). Multi-producer queues with
priority / fairness are not specified.
- **First-class read-state and notification APIs.** Harness v1 has no
  per-principal read cursors, unread counts, muted state, notification
  preferences, notification delivery API, or "last seen" timestamps. Session
  summaries and snapshots expose objective state such as `lastActivityAt`,
  `busy`, queue depth, pending inbox counts, current run, and goal/channel
  status, but they do not say which authenticated principal has seen a
  message, pending item, run, channel action, or future timeline entry. Safe
  fallback: products may keep local or application-owned read state keyed by
  the authenticated principal plus durable Harness anchors such as
  `(harnessName, resourceId, threadId)`, `sessionId`, durable message IDs,
  `runId`, pending `itemId`, channel inbox/action/outbox IDs, retained
  operation IDs such as `signalId` / `queuedItemId`, and future timeline entry
  IDs if HC-064 adds them. Retention-bounded operation IDs stop being useful
  read anchors once their result/tombstone evidence expires. SSE event IDs and
  `Last-Event-ID` are epoch-local (§10.5): they may be used for live replay
  de-dupe inside one event epoch (§10.4), but they must not be persisted as
  durable read cursors or user-visible read-state anchors. Adding
  `lastSeenMessageId`, `lastSeenTimelineEntryId`, `muted`, `notifyOnPending`,
  or similar first-class fields later requires a principal-scoped storage and
  authorization design (§13.2) and, for timeline cursors, durable timeline
  entry IDs. Legacy channel subscription metadata (`channel_subscribed`,
  `channel_externalThreadId`, `channel_externalChannelId`, `channel_platform`)
  is not part of this deferral. It is legacy channel routing/binding state,
  not per-principal read or notification state; §11.2 owns whether it
  upgrades, is ignored, or requires explicit operator/product relinking, and
  §14.1 remains the canonical owner of durable platform-conversation-to-
  session mapping.
- **First-class durable agent-produced artifact records.** Agent-produced files,
  reports, screenshots, and generated outputs stay represented by committed
  assistant messages, explicit tool results, workspace state, or
  application-owned datastore IDs. v1 does not add a `HarnessArtifact` storage
  row, artifact list/fetch API, artifact event union, or artifact-specific
  outbox kind. Safe fallback: tools that produce durable outputs include stable
  references in committed messages or tool results; products that need generated
  file browsing build product-specific workspace projections or datastore
  routes. Dependent attachment, remote-wire, channel, activity, workspace, and
  verification text may cross-reference this deferral, but must not define a
  parallel Harness artifact surface.
- **First-class durable heartbeat API.** `onInterval(...)` is process-local.
Applications that need restart-safe heartbeat behavior model it as
scheduled/proactive work that creates `HarnessWakeupItem` rows (§14.6, §15).
- **Generic MCP/app callback and non-read external-action ledgers.** v1
specifies the source-specific pattern and channel records. MCP servers, tools,
and resources are Mastra/MCP runtime dependencies and read/control surfaces, not
Harness sessions. A local or operator control plane may expose best-effort MCP
runtime status such as `connecting`, `connected`, `failed`, transport, tool
counts/names, config paths, and bounded stderr when a provider supplies them,
but that status is process-local unless a dedicated provider persists it. HTTP
MCP transport session IDs remain process-local protocol handles; if surfaced at
all, they are diagnostics, not Harness `sessionId` values or recovery keys.
Read-only MCP resources, including `ui://` app resources, and MCP resource
subscriptions remain read/control surfaces. MCP progress notifications,
elicitation requests, app callbacks, and non-read MCP/app effects need their own
source-specific rows before Harness can promise duplicate suppression, restart
recovery, or process-local client reconstruction.
- **Operator repair UI/routes beyond dispatch.** v1 keeps terminal rows and
binding migration safe by refusing hidden retargeting. Product-specific repair
tools can be built over storage later.

---
