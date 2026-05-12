### 2.7 Workspace ownership

A `Workspace` is the bundle of `WorkspaceFilesystem` + `WorkspaceSandbox` +
`Browser` that the agent's tools operate on — the "world" outside the
conversation. Harness v1 wraps the existing Mastra core `Workspace` primitive;
it does not define a second filesystem, sandbox, browser, skill scanner, or
workspace tool contract.

The canonical mapping is:

- `Session.getWorkspace()` / `resolveWorkspace()` return the current core
`Workspace` instance resolved by the harness's ownership model. `RemoteSession`
omits direct workspace access (§13.5); remote clients interact with
workspace-backed behavior through server-side tools, events, attachments, and
any product-specific wire-safe projections. Those projections are read-model or
product surfaces; they do not override the first-class output artifact deferral
(§11.5, §15.3).
- `workspace.filesystem`, when statically present, is the current core
`WorkspaceFilesystem` interface. Workspaces that use a core filesystem resolver
keep that behavior: the harness and built-in tools pass the current request
context through the core workspace APIs instead of treating `.filesystem` as a
separate Harness field. Optional provider capabilities such as
`WorkspaceFilesystemAudit` stay provider-owned diagnostics/inspection surfaces;
Harness v1 does not treat filesystem audit history as a memory source.
- Workspace-discovered skills use the current core workspace skill
source/resolver behavior, not a Harness-only filesystem scanner. Harness owns
session-level skill precedence, caching, refresh, and remote exposure (§4.6);
core Workspace owns path, glob, source, and provider-specific discovery
semantics.
- Built-in workspace tools reuse the current core workspace tool family
(`createWorkspaceTools(...)`, standalone workspace tools, and helpers). Harness
may wrap those tools only to inject session identity, request context, canonical
approval/tenant policy gates, workspace loss handling, and durability gating; it
must not introduce divergent file, sandbox, search, process, or LSP semantics.
Lazy `per-session` provisioning uses the stable wrapper contract below instead
of deriving the model-visible tool surface from a live `Workspace`.
- Current Mastra workspace registry and server workspace handlers are
implementation material for Studio/operator inspection, not the public Harness
remote contract. Harness-owned workspace inspection must be a
session/resource-scoped or operator-scoped projection and must not expose raw
`Workspace` handles or cross-resource workspace IDs to `RemoteSession` clients
(§13.5).
- Configured or registered workspace definitions are separate from per-session
resume state. Core workspace configuration owns
filesystem/sandbox/browser/search/skill/tool wiring; the Harness
`WorkspaceProvider.providerId` is a Harness-level provider identity, not
`Workspace.id` and not the filesystem/sandbox provider string.
`SessionRecord.workspace` owns only materialized per-session provider identity,
opaque state, optional generation, and loss metadata.

This section owns Harness workspace ownership, durability, and recovery; it does
not duplicate the core `Workspace`, `WorkspaceFilesystem`, `WorkspaceSkills`,
`WorkspaceSandbox`, or workspace tool contracts.

Orientation diagram (workspace ownership only; tables below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-workspace-ownership-title hx-workspace-ownership-desc" viewBox="0 0 1040 430" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-workspace-ownership-title">Workspace ownership and durability axes</title>
    <desc id="hx-workspace-ownership-desc">Harness wraps the core Workspace primitive and resolves it by shared, per-resource, or per-session ownership; durability is external, durable, or ephemeral depending on the provider shape.</desc>
    <defs>
      <marker id="ah-workspace-ownership" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="410" y="25" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="54" text-anchor="middle">Core Workspace</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="76" text-anchor="middle">filesystem / sandbox / browser</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="80" y="150" width="190" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="175" y="178" text-anchor="middle">shared</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="175" y="200" text-anchor="middle">harness lifetime</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="330" y="150" width="190" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="425" y="178" text-anchor="middle">per-resource</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="425" y="200" text-anchor="middle">resource lifetime</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="580" y="150" width="190" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="675" y="178" text-anchor="middle">per-session</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="675" y="200" text-anchor="middle">session materialized</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="820" y="150" width="150" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="895" y="178" text-anchor="middle">Remote-safe</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="895" y="200" text-anchor="middle">projection only</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="235" y="300" width="190" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="330" y="328" text-anchor="middle">external</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="330" y="350" text-anchor="middle">outside session record</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="485" y="300" width="190" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="580" y="328" text-anchor="middle">durable</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="580" y="350" text-anchor="middle">provider.resume(state)</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="735" y="300" width="190" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="328" text-anchor="middle">ephemeral</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="830" y="350" text-anchor="middle">loss fails closed</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-workspace-ownership);" d="M450 95 C345 120 220 128 180 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-workspace-ownership);" d="M500 95 C460 120 435 128 428 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-workspace-ownership);" d="M560 95 C610 120 655 128 670 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-workspace-ownership);" d="M625 95 C745 120 860 128 890 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-workspace-ownership);" d="M250 218 L320 299" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-workspace-ownership);" d="M675 218 L585 299" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-workspace-ownership);" d="M725 218 L820 299" />
  </svg>
  <figcaption>Harness resolves a core Workspace by ownership model; only per-session durable providers persist resumable workspace state in the session record.</figcaption>
</figure>

**Workspace file changes are durable workspace state, not memory events.** File
creates, writes, deletes, moves, and copies affect the workspace that later
tools
can read, but they are not Harness memory events, observational-memory inputs,
semantic-recall inputs, or durable recovery proof by themselves. If an agent
wants memory to learn an important file change, it must surface that fact
through
the shared message log: an assistant summary, committed message, or explicit
tool result. Provider-owned `WorkspaceFilesystemAudit` history may support
operator/Studio diagnostics, product-specific refresh hooks, or future scanners,
but v1 defines no generic file watcher, filesystem event feed, or file-to-memory
ingestion policy. Any future scanner must define filters, ordering,
deduplication, resource/session attribution, and advisory failure semantics
before it can feed memory.

The harness supports three ownership models, chosen at config time:

**`shared`**

Cardinality: One workspace, all sessions point at it

Used by: Single-user TUI / single-machine MastraCode

**`per-resource`**

Cardinality: One workspace per `resourceId`, shared across that user's sessions

Used by: Multi-tenant server (typical)

**`per-session`**

Cardinality: One workspace per session, provisioned on demand, torn down on
close

Used by: Devin-style autonomous tasks


The ownership model is a property of the harness, not the session. Sessions
can't override it; they get whatever workspace the harness's config dictates for
their context.

**Tools resolve workspace through the owning session.** Public in-process
callers use `session.getWorkspace()` / `session.resolveWorkspace()` (§4.2); tool
authors use the `HarnessRequestContext` workspace accessors that delegate to the
same session-owned resolver (§6.1/§6.2). This is what lets the same agent code
run against TUI, multi-tenant server, and Devin shapes interchangeably without
exposing the full `Session` object inside tool execution.

`harness.getWorkspace()` exists for *out-of-session* contexts only — init
scripts, admin tooling, batch jobs without a session reference. In
`per-resource` and `per-session` shapes, it returns `undefined`; those shapes
don't have a meaningful harness-level workspace.

Lifecycle:
- `shared` — torn down on `harness.shutdown()`.
- `per-resource` — torn down on explicit
`harness.destroyResourceWorkspace({ resourceId })`. Outlives individual
sessions; operators run sweepers for stale resources.
- `per-session` — torn down automatically on `session.close()`.

Provisioning is **lazy by default** (workspace materialises on first
workspace-dependent runtime work or explicit `resolveWorkspace()` call) and can
be flipped to eager via `eager: true` in the factory config. Cloud sandboxes
have non-trivial cold-start times; lazy keeps "user typed, agent answered" fast
in cases where no workspace access is needed.

**Stable wrapper contract for lazy built-in workspace tools.** A session that
needs the exact current `createWorkspaceTools(...)` surface may choose eager
materialisation before exposing built-in workspace tools. A lazy `per-session`
workspace must not cold-start merely to list tools or assemble the model prompt.
Instead, Harness registers only a stable wrapper manifest whose names and input
schemas are known without calling provider `create(...)` / `resume(...)` or
probing a live `Workspace`. The manifest may use static Harness configuration,
duplicate-free static aliases, and current core workspace tool
constants/schemas; it must not evaluate live `Workspace` capability, read-only,
dynamic `enabled`, search-mode, sandbox-process, or LSP checks at registration
time. If an implementation cannot construct a stable manifest without those live
checks, it must use the eager path before exposing the exact workspace tool
surface rather than guessing from a partially materialised workspace.

Wrapper execution resolves or resumes the owning session workspace through the
same session-owned resolver that backs `Session.resolveWorkspace()` and the
`HarnessRequestContext.resolveWorkspace()` projection (§4.2, §6.2). Subagent
wrappers resolve the inherited parent workspace or the fresh child workspace
according to the same §8 ownership rule. After resolution, the wrapper delegates
to the corresponding current core workspace tool behavior and preserves the core
tool-family semantics for the resolved workspace/run, including
read-before-write tracking, write serialization, configured approval hooks,
custom output limits, and exposed-name validation where those settings are
available without changing the registered manifest mid-run. Wrappers are not
independent reimplementations of file, sandbox, search, process, or LSP
behavior.

Execution-time workspace loss, provider mismatch, missing
filesystem/sandbox/process capability, unsupported search mode, read-only write
attempt, dynamic `enabled: false`, unavailable AST/LSP support, or session
lifecycle failure fails closed through the tool invocation result/error path and
does not mutate the registered names or schemas for the in-flight run. Canonical
pre-exposure permission and tenant-policy gates still apply where the Harness
policy layer has enough information before the model sees the tool; HC-279 does
not weaken the §4.2 permission-filtering rule for dynamic discovery surfaces
such as ToolSearch. Parallel wrapper calls against one lazy session must
single-flight through the owning session resolver so first
materialisation/resume creates at most one workspace and all callers observe the
same resolved workspace or the same fail-closed workspace error.

Subagents **inherit the parent session's workspace by default**. If isolation is
required (e.g. running untrusted code), the subagent tool config opts in to a
fresh workspace. See §8.

Workspace durability is a separate axis from ownership:

**`external`**

Applies to: `shared`, `per-resource`

Harness persistence: No per-session workspace state in `SessionRecord`

Recovery rule: The harness resolves the configured workspace before
workspace-dependent runtime work. If it cannot be resolved, work fails closed
with `HarnessWorkspaceLostError`; the session is not resumed with a substitute
workspace.

**`durable`**

Applies to: `per-session` with `resumable: true`

Harness persistence: `SessionRecord.workspace` stores provider identity, opaque
state, and optional provider generation (§5.1)

Recovery rule: Existing active sessions resume only through
`provider.resume({ state, ... })`; `provider.create(...)` is used only for a
session that has not yet materialised a workspace.

**`ephemeral`**

Applies to: `per-session` with `resumable: false`

Harness persistence: `SessionRecord.workspace` stores enough identity to report
loss if the workspace had materialised

Recovery rule: Valid only as an explicit process-local tradeoff. After restart,
eviction that destroys the backing workspace, provider loss, or missing state,
the session fails closed with `HarnessWorkspaceLostError` before accepting
workspace-dependent work. It never silently provisions a fresh workspace for the
same active session.

The `lostAt`-first ordering rule applies to all durability modes that persist
`lostAt` on `SessionRecord.workspace`: when `lostAt` is set, recovery fails
closed with `HarnessWorkspaceLostError(lostReason)` before reading `state` or
calling `provider.resume(...)`. See §5.1a.02 and §5.7c for the authoritative
rule.


`shared` and `per-resource` shapes are `external` because their state is owned
outside the session record. `per-resource` teardown checks persisted active
sessions for the resource before destroying anything; an evicted-but-active
session blocks teardown just like an in-memory session.

Per-session durable workspaces are durable across server restarts: provider
state is persisted in the session record (§5.1). On rehydration, the provider
resumes the workspace from its stored state.

To make this contract testable at startup — without provisioning a real sandbox
just to probe it — `kind: 'per-session'` configs use the **`WorkspaceProvider`**
shape rather than a bare factory. A provider declares three things up front:

- **`providerId`** — a stable Harness provider identifier (`'e2b'`, `'daytona'`,
`'modal'`, `'local'`, …) that is written into
`SessionRecord.workspace.providerId` and matched on rehydration for durable
workspace records. This is the configured `WorkspaceProvider` identity, not the
core `Workspace.id` and not the filesystem/sandbox provider string. For
`durability: 'durable'`, the harness refuses to rehydrate a record whose stored
`providerId` doesn't match the configured provider, surfacing
`HarnessWorkspaceProviderMismatchError` rather than handing a record to the
wrong implementation. For `durability: 'ephemeral'`, the stored durability
marker wins first: restart/eviction loss surfaces `HarnessWorkspaceLostError`,
and `providerId` is only diagnostic loss-reporting identity.
- **`resumable: boolean`** — the static durability declaration for `per-session`
workspaces. `true` means durable: `resume({ state, ... })` is required and
existing active sessions recover only through that method. `false` means
ephemeral: the provider may be used within one process lifetime, but any
existing active session whose materialised workspace cannot be proven current
after restart/eviction fails closed instead of creating a replacement workspace.
- **A lifecycle pair — `create({...})` and (when resumable)
`resume({ state, ... })`.** `create` is called the first time a session needs a
workspace (or eagerly at session creation, if `eager: true`); it returns a live
`Workspace`. For `resumable: true`, the harness passes `onStateChange(update)`
in the create/resume context (§9). The provider calls and awaits that hook after
initial create state is known and after every later durable provider-state
change inside the workspace (for example, a sandbox-id rotation). The hook is a
recovery-state commit barrier: it resolves only after the fresh opaque provider
state and optional generation token are written into `SessionRecord.workspace`
under the owning session lease. If it rejects, the provider must not treat the
new state as safely recoverable or continue workspace-dependent work that relies
on it. After a server restart, the harness calls
`provider.resume({ state, ... })` with the stored blob and gets a live
`Workspace` back. If the provider reports a generation token, the harness stores
it with the workspace state and passes it back on resume so provider-side
sandbox replacement can be fenced.

The factory-function shorthand (a bare `(ctx) => Workspace`) remains as sugar
but is **explicitly ephemeral**: it desugars to a `WorkspaceProvider` with
`resumable: false`, no `resume` implementation, and a reserved non-durable
`providerId` used only for diagnostics and loss reporting. It must not derive
persisted provider identity from the function reference, and it is never a
durable provider-matching key. After a server restart or backing workspace loss,
the harness treats any active session whose materialised workspace came from
shorthand as having lost its workspace. Pending tool calls, resumes, queue
drains, and new workspace-dependent runtime work fail with
`HarnessWorkspaceLostError`. The harness does **not** call `create` to give that
existing session a fresh workspace. New sessions may still materialise a new
ephemeral workspace. Callers that need continuity across restarts or stable
provider matching must use the full provider shape with an explicit `providerId`
and `resumable: true`. This is documented at the call site and again in §9.

`shared` and `per-resource` shapes don't carry a `providerId` because their
workspaces aren't tied to a specific session record. `shared` workspaces live
for the harness lifetime. `per-resource` workspaces live until explicitly
destroyed and are resolved from the configured resource workspace source when
first needed after a restart; if that source cannot provide a workspace
compatible with existing active sessions, those sessions fail closed with
`HarnessWorkspaceLostError` instead of silently continuing against unrelated
state.

---
