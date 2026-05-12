### 13.5 What does not cross the wire

`RemoteSession` is defined as `Session` **minus** the session surface listed
below, and the remote harness type similarly omits Harness-only server hooks.
These methods and fields are absent from the remote types, so calling them
yields a TypeScript error rather than a runtime surprise. The remainder — what
*does* cross the wire — is the shared `RemoteSafeSession` interface introduced
in §2.6, and is the only session surface that portable client code should depend
on.

- **Direct workspace access** (`session.getWorkspace()`,
`harness.getWorkspace()`, raw `Workspace` handles). The workspace lives
server-side; the client interacts with it through tools, events, and the
file-attachment routes. Attachment routes are for caller-supplied inputs only,
not generated-file browsing or artifact fetch (§11.5, §15.3). Products that need
a generated-output browser expose product-specific workspace projections or
application datastore routes with their own authorization; direct handles would
punch through the trust boundary.
- **Function-valued `addTools` per-turn override.** Tool implementations are
closures, and closures don't serialize. Tools must be registered on the
server-side `HarnessConfig`. `addTools` is already absent from `QueueOptions`
everywhere (§4.4) — durable queued items can't represent a tool surface that
storage can't reproduce. On `MessageOptions` and `UseSkillOptions` it's allowed
in-process but omitted from the remote types, so reaching for it on a
`RemoteSession` is a compile-time error. Per-turn `model`, `mode`, and `yolo`
overrides still cross the wire, but wire `yolo: true` is a privileged
approval-bypass field and requires the principal capability in §13.2 before
admission.
- **Local schema objects.** `PublicSchema`, Zod schemas, ArkType types, and any
other live schema implementation object are local-only. Schema-bearing request
fields and skill descriptor reads use the `WireSchemaRef` and
`WireHarnessSkillDescriptor` DTOs in §13.3: JSON Schema Draft 2020-12 objects or
server-owned schema IDs. The server never accepts functions/classes as schemas
over HTTP, and descriptor routes never return schema objects that require JS
runtime identity to interpret.
- **Top-level `requestContext` keys other than `app`.** Caller metadata crosses
the wire only as canonical JSON under `requestContext.app`; client bodies that
violate the §4.4 request-context allowlist are rejected before session
admission. Infrastructure-owned slots are set by the server, Harness, agent,
workflow, memory, browser, or channel bridge after their own trust checks; they
never originate from client request bodies.
- **Bearer-equivalent auth tokens in URL query parameters.** Main
  authentication credentials do not cross the Harness client/session boundary
  as `?apiKey=...` or any equivalent query parameter. The only query credential
  shape in v1 is the optional scoped subscription token for the per-session
  `/events` SSE route (§13.2/§13.3); it is read-only, route-scoped, short-lived,
  and never becomes caller request context or a downstream forwarded auth token.
- **Raw top-level thread metadata writes.** `setThreadSetting(...)` crosses the
wire only as an app-metadata key write to `thread.metadata.app[key]`. Clients
cannot mutate top-level thread metadata keys such as legacy mode/model fields,
channel subscription fields, memory/working-memory fields, subagent fork
markers, token usage, thread titles, or future Harness/Mastra namespaces. Those
fields are managed by typed Session, thread, channel, memory, or migration code
on the server.
- **Remote `harness.subscribe(...)`.** The local control-plane stream fans out
harness and session events for one in-process Harness instance; it does not
cross the wire in v1, filtered or unfiltered. Remote clients use per-session
`session.subscribe(...)`, which rides the SSE route from §13.3.
- **Local default-resource helpers.** `harness.getDefaultResourceId()` is an
  in-process convenience that returns the optional configured
  `defaultResourceId`; it is absent from the remote harness type. Server routes
  derive `resourceId` from authenticated context on every client-facing call
  (§13.2), so a remote client cannot use a local default to choose, reset, or
  prove tenant scope.
- **Interval handlers** (`harness.onInterval`). This is also a Harness method
and a server-side concern; clients can't register code to run on the server.
- **The functional form of `setState`** (`setState(prev => next)`). The updater
is a closure executed against live state under the session lease, and closures
cannot be sent across the wire. The object form (`setState(patch)`) is on
`RemoteSession` and rides the dedicated `PATCH /sessions/:sessionId/state` route
(§13.2) using the §5.1 top-level merge algorithm. Remote object-form patches
cannot delete keys; callers that need deletion must use local/tool-context
functional `setState` on the server or model the field behind a server-owned
command. Remote callers that need read-modify-write must
`await session.getState()`, compute the next patch locally, and PATCH it. Remote
PATCH uses the snapshot's `ETag` / `If-Match` validator to reject stale writes
with `harness.state_conflict`, so stale clients cannot silently overwrite each
other. It is still not an atomic cross-client read-modify-write primitive:
clients must refetch and recompute after conflict, and any intervening durable
session write can force that conflict. If atomic read-modify-write semantics
matter, fall back to `setState(prev => next)` in-process or model the field as
something the server already serialises (a queued item, a goal, a permission
grant) instead.
- **Question/plan registration.** `registerQuestion(...)` and
  `registerPlanApproval(...)` are tool-context-only `HarnessRequestContext`
  methods (§6.1), not public `Session` methods. They require an active run,
  tool call identity, pending item identity, owning session, and workflow
  suspension target supplied by the server-created tool context. Remote clients
  answer the resulting pending items through `respondToQuestion(...)`,
  `respondToPlanApproval(...)`, or the §13.4 inbox helper.
- **Non-JSON values inside `state`.** Functions, class instances, circular
references, `Map`, `Set`, and `Date` do not round-trip. Same constraint as the
in-process state commit: violations reject with `HarnessStateSerializationError`
(§4.5, §5.1). Recommended: keep `state` to plain JSON shapes and put richer
values behind ID references in workspace files, attachments, or your own
datastore.
- **`session.refreshSkills()`.** Workspace skill discovery runs server-side
through the resolved session workspace's configured `WorkspaceSkills`
source/resolver; only the server can run that discovery and invalidate its
generation, so the method is absent from `RemoteSession`. The `listSkills` /
`getSkill` / `useSkill` reads remain. They serve from the current server-side
generation when one exists, and first access may populate either a final
generation or a non-final code-only inspection result under the lazy-workspace
rules in §4.6. Remote products that want a manual refresh should expose a
product-specific route that calls `session.refreshSkills()` server-side, or
close and re-open the session.
- **Direct `HarnessStorage` access.** The remote SDK never exposes the storage
interface; durable state is reached only through `Session` methods.

`RemoteSafeSession` is the interface name, declared in §4.8. Clients targeting
both deployment shapes should declare their dependencies as `RemoteSafeSession`,
not `Session`, to keep the local/remote distinction enforced at the type system.

**Asymmetric local/remote wrappers.** A handful of memory-served reads are sync
on the in-process `Session` and async on `RemoteSession` — for example
`getState`, `getDisplayState`, mode/model/O.M. config reads,
concurrency/inspection reads, and `getGoal`. `getState` returns the same
detached read-only state snapshot shape (`ReadonlyState<TState>`) on both
surfaces, and `getDisplayState` returns the same JSON-safe
`HarnessDisplayStateSnapshotV1` shape on both surfaces; only the sync/async
wrapper differs. `session.om.getRecord()` is async on both surfaces because it
reads the memory store, and remote callers receive the same JSON-safe
`ObservationalMemorySnapshot` projection defined in §4.8, never the raw
MemoryStorage OM row. Rich in-process display internals such as `Map`, `Set`, or
`Date` values do not cross this public boundary. `RemoteSafeSession` types these
as `Awaitable<T> = T | Promise<T>` so both implementations satisfy the same
portable interface. Persisted mutators are not part of this asymmetry:
permission grants/revokes/policies, goal set/pause/resume/clear, OM model
switches, and all other durable session mutations are `Promise`-returning on
every session variant. In-process callers that prefer cheaper sync reads should
narrow their parameter type to `Session` explicitly; portable code awaits.
