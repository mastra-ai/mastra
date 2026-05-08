### 2.7 Workspace ownership

A `Workspace` is the bundle of `WorkspaceFilesystem` + `WorkspaceSandbox` + `Browser` that the agent's tools operate on — the "world" outside the conversation.

The harness supports three ownership models, chosen at config time:

| Kind | Cardinality | Used by |
|---|---|---|
| `shared` | One workspace, all sessions point at it | Single-user TUI / single-machine MastraCode |
| `per-resource` | One workspace per `resourceId`, shared across that user's sessions | Multi-tenant server (typical) |
| `per-session` | One workspace per session, provisioned on demand, torn down on close | Devin-style autonomous tasks |

The ownership model is a property of the harness, not the session. Sessions can't override it; they get whatever workspace the harness's config dictates for their context.

**The only access path tools use is `session.getWorkspace()`.** Whatever the ownership model, a tool asks its session and gets back a `Workspace`. This is what lets the same agent code run against TUI, multi-tenant server, and Devin shapes interchangeably.

`harness.getWorkspace()` exists for *out-of-session* contexts only — init scripts, admin tooling, batch jobs without a session reference. In `per-resource` and `per-session` shapes, it returns `undefined`; those shapes don't have a meaningful harness-level workspace.

Lifecycle:
- `shared` — torn down on `harness.shutdown()`.
- `per-resource` — torn down on explicit `harness.destroyResourceWorkspace({ resourceId })`. Outlives individual sessions; operators run sweepers for stale resources.
- `per-session` — torn down automatically on `session.close()`.

Provisioning is **lazy by default** (workspace materialises on first tool call) and can be flipped to eager via `eager: true` in the factory config. Cloud sandboxes have non-trivial cold-start times; lazy keeps "user typed, agent answered" fast in cases where no tool call is needed.

Subagents **inherit the parent session's workspace by default**. If isolation is required (e.g. running untrusted code), the subagent tool config opts in to a fresh workspace. See §8.

Per-session workspaces are durable across server restarts: provider state is persisted in the session record (§5.1). On rehydration, the provider resumes the workspace from its stored state.

To make this contract testable at startup — without provisioning a real sandbox just to probe it — `kind: 'per-session'` configs use the **`WorkspaceProvider`** shape rather than a bare factory. A provider declares three things up front:

- **`providerId`** — a stable string identifier (`'e2b'`, `'daytona'`, `'modal'`, `'local'`, …) that is written into `SessionRecord.workspace.providerId` and matched on rehydration. The harness refuses to rehydrate a record whose stored `providerId` doesn't match the configured provider, surfacing `HarnessWorkspaceProviderMismatchError` rather than handing a record to the wrong implementation.
- **`resumable: boolean`** — a static capability declaration. The harness validates this at `init()` time: a `per-session` config against a `resumable: false` provider is rejected immediately with `HarnessConfigError` ("workspace provider X is not resumable; only `kind: 'shared'` is supported"). No `create()` call is made to discover this — startup validation stays cheap and lazy provisioning stays lazy.
- **A lifecycle pair — `create({...})` and (when resumable) `resume({ state, ... })`.** `create` is called the first time a session needs a workspace (or eagerly at session creation, if `eager: true`); it returns a live `Workspace`. After every durable state change inside that workspace (e.g. a sandbox-id rotation), the workspace pushes fresh opaque bytes up to the harness via a state-update hook the harness wires in at construction time; the harness writes those bytes into `SessionRecord.workspace.state`. After a server restart, the harness calls `provider.resume({ state, ... })` with the stored blob and gets a live `Workspace` back.

The factory-function shorthand (a bare `(ctx) => Workspace`) remains as sugar but is **explicitly non-durable**: it desugars to a `WorkspaceProvider` with `resumable: false` and an auto-generated `providerId` derived from the function reference. After a server restart, the harness treats any session whose stored `providerId` matches a non-resumable provider as having lost its workspace — pending tool calls fail with `HarnessWorkspaceLostError` and the next tool call provisions a fresh workspace via `create`. Callers that need durability must use the full provider shape. This is documented at the call site and again in §9.

`shared` and `per-resource` shapes don't carry a `providerId` because their workspaces aren't tied to a specific session record. `shared` workspaces live for the harness lifetime; `per-resource` workspaces live until explicitly destroyed and are recreated from scratch when first needed after a restart.

---
