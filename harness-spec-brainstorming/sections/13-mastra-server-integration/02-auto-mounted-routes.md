### 13.2 Auto-mounted routes

When the harness is registered on a `Mastra` instance served by Mastra Server, the following routes are auto-mounted under `/harness/:harnessName`:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/harness/:name/sessions` | List sessions for the authenticated resource |
| `POST` | `/harness/:name/sessions` | Resolve (find-or-create) a session |
| `GET` | `/harness/:name/sessions/:sessionId` | Get session summary + current state snapshot |
| `DELETE` | `/harness/:name/sessions/:sessionId` | Close (terminate) a session |
| `POST` | `/harness/:name/sessions/:sessionId/messages` | Send a message (`message` — busy-independent, signal-driven). Body `{ content, files?, ...overrides }`. Returns `{ runId, signalId }`. Final result observed via the SSE event stream. Never returns `409 harness.busy`; admission errors map to `400 harness.validation`, `404 harness.session_closed`, `503 harness.storage`, or `409 harness.override_conflict` (when `model`/`mode`/`addTools` are set on a signal draining into an active run — body carries `activeRunId` and `conflictingFields`). |
| `POST` | `/harness/:name/sessions/:sessionId/messages?sync=true` | Sync send with typed output (`message({ sync: true, output })`). Returns the typed result body. May respond `409 Conflict` with a `HarnessBusyError` payload. |
| `POST` | `/harness/:name/sessions/:sessionId/messages?stream=true` | Stream a turn (SSE, `message({ stream: true })`). The response body is an SSE stream of the answering turn's chunks. |
| `POST` | `/harness/:name/sessions/:sessionId/queue` | Enqueue an item for sequential delivery (`queue` — busy-independent). Returns `{ queuedItemId }`. Item runs as a fresh standalone turn once the thread is idle. Never returns `409 harness.busy`; admission errors map to `400 harness.validation`, `404 harness.session_closed`, `503 harness.storage`, or `429 harness.queue_full` (when `sessions.maxQueueDepth` would be exceeded — body carries `currentDepth` and `maxQueueDepth`). |
| `POST` | `/harness/:name/sessions/:sessionId/skills/:skillName` | Invoke a skill (`useSkill`). May respond `409 Conflict`. |
| `GET` | `/harness/:name/sessions/:sessionId/events` | Subscribe to session events (SSE). |
| `POST` | `/harness/:name/sessions/:sessionId/inbox/:itemId` | Respond to a pending approval / suspension / question / plan. Body discriminates on `kind`: `'tool-approval'` carries `{ approved, reason? }`, `'tool-suspension'` carries `{ resumeData }`, `'question'` carries `{ answer }`, `'plan-approval'` carries `{ approved, reason? }`. |
| `PATCH` | `/harness/:name/sessions/:sessionId/mode` | Switch mode |
| `PATCH` | `/harness/:name/sessions/:sessionId/model` | Switch model |
| `PATCH` | `/harness/:name/sessions/:sessionId/permissions` | Set policy / grant / revoke |
| `GET` | `/harness/:name/sessions/:sessionId/state` | Read the current `TState` snapshot. Returns the full state object. Cheaper than `GET /sessions/:sessionId` when a caller only needs `state`. |
| `PATCH` | `/harness/:name/sessions/:sessionId/state` | Apply a JSON patch to `state` — the object form of `setState`. Body is the partial state object. Server validates JSON-serialisability (rejects with `400 harness.state_serialization` otherwise), shallow-merges under the session lease, persists as a durable transition (§5.7), and emits a `state_changed` event before the response returns. The functional form of `setState` does not have a wire route — closures cannot be sent across the boundary; remote callers must compute the patch locally and PATCH the result. Body must be a JSON object (top-level array / scalar rejected with `400 harness.validation`). |
| `GET` | `/harness/:name/threads` | List threads for the authenticated resource |
| `POST` | `/harness/:name/threads` | Create a thread |
| `GET` | `/harness/:name/threads/:threadId/messages` | List messages for a thread |
| `POST` | `/harness/:name/sessions/:sessionId/attachments` | Pre-upload an attachment (multipart). Returns `attachmentId`. See §13.7 |
| `DELETE` | `/harness/:name/sessions/:sessionId/attachments/:attachmentId` | Drop an unused pre-uploaded attachment |

**Inbox routing.** `POST /harness/:name/sessions/:sessionId/inbox/:itemId` requires `:sessionId` to be the **owning session** for the pending item. For prompts emitted with `source: 'parent'`, that's the same session whose event stream surfaced the event. For prompts emitted with `source: 'subagent'`, the owning session is the **subagent's** session — its ID is given by the `subagentSessionId` field on the event (§10.6), and a UI watching the parent's SSE stream uses that field to pick the right URL. Posting to a non-owning session returns `404 inbox.item_not_found`. The server does not maintain a cross-session inbox routing table — `inbox` is a flat per-session resource.

The same rule applies to subagent sessions that have themselves spawned grandchild subagents: the inbox lives wherever the prompt was emitted, not on any ancestor.

Tenancy: every route is gated by Mastra Server's auth middleware. The middleware resolves the authenticated `resourceId`, which is passed to the harness on every call. **Clients never send `resourceId` themselves** — the server is the source of truth.

Session ownership: every `:sessionId` lookup verifies the session's `resourceId` matches the authenticated caller before returning. Cross-tenant access returns `404` (not `403`) to avoid leaking session existence. Subagent sessions inherit the parent's `resourceId` (§5.6), so the same caller that can address the parent can address its descendants.
