### 11.5 What's not in v1

These are deferred. Each can be added as an additive feature later without breaking the v1 contract.

- **Shared / collaborative threads across resources.** Threads are single-tenant in v1 (§2.3). Two users participating in the same conversation today is built outside the harness. If we add it later, it'll be an opt-in ACL on the thread record, not a relaxation of the existing `(resourceId, threadId)` lookup invariant.
- **Detach without close.** `harness.detachSession({ sessionId })` (proactively flush + drop without setting `closedAt`) — happens implicitly today via eviction (§5.4). We add an explicit method when a real caller needs it.
- **Nested goals.** A session holds at most one goal in v1 (§4.7). Spawn a child session if you need a sub-goal.
- **Pluggable workspace ACLs.** Workspaces today are owned by the session or resource that provisioned them (§2.7). Cross-session sharing of a workspace under a permission model is out of scope.
- **Cross-instance `'wait'` lock coordination beyond a single storage backend.** §5.8's lock modes assume the same storage adapter is shared across processes. Federated storage with cross-region lease coordination is not specified.
- **Multi-server SSE fan-out.** §13 deploys behind a single Mastra Server process or a sticky-session load balancer. True multi-instance event subscription waits on Mastra Worker (out of scope here).
- **First-class collaboration semantics on `pendingQueue`.** Items in the queue assume a single producer (the session's resource). Multi-producer queues with priority / fairness are not specified.

---
