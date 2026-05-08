# Harness v1 — Technical Spec

## 1. What the Harness is

The Harness is an orchestration layer that sits between an application and the Mastra agent runtime. It owns the lifecycle of conversations, the resolution of models/modes/tools/skills, and the bridge between user-facing UIs and agent execution.

Two roles, cleanly split:

- **`Harness`** — stateless infrastructure. Holds Mastra, the model resolver, the mode catalog, the skill registry, the workspace factory, and a registry of live sessions. Created once per process.
- **`Session`** — per-conversation runtime. Owns the live state of a single conversation: its thread, its mode, its current model, its display state, its pending approvals, its in-flight operations. Created on demand, disposed when the conversation closes.

A useful mental model:

> The Harness is the building. Sessions are the rooms. A room has its own occupants, lights, and state. The building has the wiring, plumbing, and front desk.

---

## 2. Core concepts

### 2.1 Harness vs Session

The Harness is **stateless infrastructure**. It owns shared concerns — storage, mode catalog, model resolver, skill registry, workspace factory, intervals, listeners — but holds no per-conversation state itself. It's a registry and factory.

A Session is **per-conversation runtime**. It owns everything that's specific to one ongoing conversation: current mode, current model, token usage, display state, queue, pending approvals, permissions, observational-memory progress.

```
Harness                    Session
─────────────────────      ────────────────────────────
Stateless                  Stateful
Shared across users        One per conversation
Owns infrastructure        Owns runtime state
Lives for the process      Persists across restarts (§5)
Created once               Created on demand
```

Code holds references to `Session` objects. The Harness is the thing that hands them out.

### 2.2 Thread vs Session

| | Thread | Session |
|---|---|---|
| What | Persistent message log | Per-conversation runtime + persisted runtime state |
| Storage | `MastraStorage.harness` (threads + messages) | `MastraStorage.harness` (session records) |
| Lifetime | Until explicitly deleted | Until explicitly closed; survives process restarts |
| Cardinality | One per conversation | One or more per thread, **all belonging to the same resource** |
| In memory? | Loaded on demand | Hydrated on demand; auto-evicted when idle |

A thread is the message history. A session is the live conversation that operates on it. Closing a session does not delete the thread.

The "one or more sessions per thread" cardinality refers to **the same user** holding multiple sessions on the same thread — typical reasons:

- The same human on a laptop and a phone, both attached to the conversation. Each device gets its own `Session` instance (potentially with its own deterministic `sessionId` derived from `(userId, deviceId)`); both read and write the same thread.
- A long-running conversation that gets rehydrated by a different server process on each request. Different `Session` instances over time, same thread, same resource.
- Operator tooling resuming a thread programmatically alongside the original user's live session.

Threads are **not** shared across resources in v1. A thread is permanently bound to the `resourceId` it was created under, and it is only addressable by that resource. Cross-tenant shared / collaborative threads are intentionally out of scope (see §11.5 on what's not in v1).

### 2.3 Resource

A `resourceId` represents a tenant — usually a user or a logical owner. **Threads and sessions are both single-tenant**: every thread has exactly one `resourceId`, and every session inherits its thread's `resourceId`. This is a hard isolation boundary, not a hint.

The lookup key everywhere is `(resourceId, threadId)` for threads and `(resourceId, sessionId)` for sessions. Storage primitives may accept just `threadId` / `sessionId` for harness-internal operations (cascade-delete, migrations, admin tools), but the harness layer always cross-checks `resourceId` before returning to a caller. A mismatch is treated identically to "does not exist" — the harness throws `HarnessSessionNotFoundError` for sessions and returns `null` (or `404` over the wire) for threads. **Cross-tenant access never returns 403 — it returns 404, so existence isn't leaked.**

Concretely:

- `harness.session({ threadId, resourceId })` — if the thread exists but belongs to a different resource, behaves as if the thread does not exist (creates a fresh thread + session under the caller's `resourceId`).
- `harness.session({ sessionId })` — allowed for single-tenant deployments. The harness looks up the record and returns it. **Recommended:** pass `{ sessionId, resourceId }` whenever the caller knows the resource. If `resourceId` is supplied and the stored record's `resourceId` doesn't match, throws `HarnessSessionNotFoundError`. The wire protocol always passes `resourceId` from auth (§13.2), so server callers always get the cross-check.
- `harness.threads.get({ threadId, resourceId })` — `null` for cross-tenant access.
- Subagent sessions inherit the parent's `resourceId` and are addressable only under that resource.

In server deployments, `resourceId` is resolved server-side from auth context. Clients never send it themselves (see §13).

### 2.4 Subagent and Parent

A subagent runs inside a child session. The child session record carries `parentSessionId` pointing at the spawner. Parent linkage flows through events (`parentId`, `depth`) so observers can reconstruct the call tree without holding live object references.

Subagent depth is computed from the chain of `parentSessionId` records, not from a runtime counter. The depth cap (§8) holds across restarts.

### 2.5 Modes, Models, Skills

- **Mode** — a named persona/policy preset (e.g. `"build"`, `"plan"`). Carries instructions, tool filters, model preferences. Per-session, with optional per-turn override.
- **Model** — the LLM identity (`provider/model-name`). Per-session, with optional global default and per-turn override.
- **Skill** — a named, parameterised prompt loaded from `.claude/skills/<name>/SKILL.md` or registered programmatically. Invoked explicitly via `session.useSkill()`.

### 2.6 Local vs remote

The harness ships two session types and one shared interface.

- **`Session`** (in-process) — `mastra.getHarness('coding').session(...)`. Full surface: messaging, queue, abort, workspace handles, interval handlers, in-memory state, custom tool registration on per-turn overrides, function-valued callbacks. Most method calls are synchronous JS calls into the same process; reads that the in-process harness can serve from memory (`getState`, `getDisplayState`) are sync.
- **`RemoteSession`** (remote SDK) — `mastraClient.getHarness('coding').session(...)`. A **strict subset** of `Session` exposed over HTTP/SSE. Anything that does not cross the wire (raw workspace handles, function-valued `addTools`, interval handlers, cross-session subscriptions, the functional form of `setState`) is omitted from the type entirely, so misuse is a compile-time error rather than a runtime surprise. See §13.5 for the exact list. Reads served from memory in-process (`getState`, `getDisplayState`) become async over the wire, since the SDK has to fetch them.
- **`RemoteSafeSession`** (shared interface) — the typed contract that both `Session` and `RemoteSession` satisfy. It captures exactly the methods that round-trip cleanly: `message`, `queue`, `abort`, `useSkill`, `subscribe`, `getDisplayState`, `listMessages`, the approval / question / plan response methods, `getState` (reads), the object-form `setState` (JSON patch), `setGoal` and friends, `uploadAttachment` / `deleteAttachment`, and the readonly identity fields (`id`, `threadId`, `resourceId`, …). To stay portable across both shapes, `RemoteSafeSession` widens the memory-served reads to async — `getState()` returns `Promise<Readonly<TState>>`, `getDisplayState()` returns `Promise<DisplayState>`. In-process callers either `await` the promise or, if they need the cheaper sync read, narrow to `Session` explicitly.

Code that needs to run in both environments should be authored against `RemoteSafeSession`, not `Session`. Code that only ever runs in-process (a TUI host, a server-side workflow, a built-in tool) is free to use the full `Session` surface.

This means the same UI or backend job can target a local harness or a remote Mastra Server by importing the right client and constraining itself to `RemoteSafeSession` — without implying that every method on a local `Session` is portable to `RemoteSession`.

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

## 3. Concurrency model

The session has two messaging primitives plus skill invocation. The model is built on **agent signals**: the agent owns the per-thread run loop and exposes `subscribeToThread()` + `sendSignal()`. The harness/session is a control surface over that, not the runtime.

| Operation | Idle thread | Active run on this thread | Returns |
|---|---|---|---|
| `message(opts)` | Starts a new run | **Drains into the live run** as new user input (no abort) | `Promise<AgentResult>`, or `AgentStream` if `stream: true`, or typed result if `output` is set |
| `queue(opts)` | Sends as the next standalone turn | **Holds until idle**, then sends as a fresh turn | `Promise<AgentResult>` resolved when *this* item's turn completes |
| `useSkill(name, opts)` | Runs the skill (delegates to `message`) | Throws `HarnessBusyError` | Typed or untyped result |

**`message` is busy-independent.** Multiple concurrent `message()` calls (10 users typing at once) all deliver regardless of in-flight state — Slack semantics. From the model's perspective they show up as a sequence of user inputs interleaved into whatever reasoning context is live. Each caller's promise resolves independently when the run produces an assistant turn answering their signal. As with `queue`, admission can still fail for reasons unrelated to busy-ness — invalid options, closed session, storage failure on the signal write — but never with `HarnessBusyError`.

Per-turn overrides (`model`, `mode`, `addTools`) on a `message()` that drains into an *already-active* run are rejected at admission with `HarnessOverrideConflictError`: the run's surface is committed at start time and a signal cannot mutate it mid-flight. Overrides on a `message()` that lands while idle apply normally to the new run. See §4.3 for the full table.

**`queue` is busy-independent.** It is *never* rejected for the reasons that would cause a `sync` operation to throw `HarnessBusyError` (run in flight, pending approval/question/plan, non-empty queue) — busy state is precisely what `queue` is for. It can still be rejected at admission time for reasons that have nothing to do with busy-ness: invalid `MessageOptions` (`HarnessValidationError`), a closed session (`HarnessSessionClosedError`), storage failure on the durable append (`HarnessStorageError`), or the per-session queue depth cap being reached (`HarnessQueueFullError`, see below). Admission is atomic per session: the capacity check and the durable append happen under the session's write lease (§5.8) so two concurrent `queue()` calls cannot both observe space and commit past the cap. Once an item is admitted it follows the queued-item retry and recovery semantics in §5.7.

When admitted, items append to a per-session FIFO held in `SessionRecord.pendingQueue` (durable). When the thread reaches an idle boundary, head of queue is drained as a fresh standalone turn. Items run sequentially, one full turn each — they do not merge with concurrent `message` inputs. The cap on this FIFO is configured via `sessions.maxQueueDepth` (§9; default unbounded).

`HarnessBusyError` no longer fires from interactive `message()`. It only fires from the explicit fail-fast forms:
- `message({ output, sync: true })` — typed structured output needs a clean turn boundary, so this form skips signals and calls `agent.generate()` directly with a fresh `runId`. Throws if the thread is busy.
- `useSkill(...)` — same story; skills need a committed turn boundary.

Across sessions: fully parallel. No shared mutable state.

**Cancellation is not a session concern.** With signals, messaging and stopping are orthogonal. If a client wants the "STOP/WTF rage abort" pattern, it does that through the agent layer (or whatever surface owns the run loop) and then calls `session.message()` for the new content. There is no `session.steer()`, no `session.abort()`, no `session.clearQueue()` in v1.

**When to use which:**
- `message` — the default. Interactive UI, multi-user fan-in, "send this whenever the agent can pick it up." Always accepted, always delivered.
- `queue` — scripted multi-step flows where you specifically want sequential, isolated turns ("first refactor X, then add tests, then run the suite"). Or programmatic agents that need predictable per-prompt boundaries. Niche by comparison to `message`.
- `message({ output, sync: true })` — headless typed extraction on a clean turn boundary.
- `useSkill` — invoke a parameterised, named prompt template.

---

## 4. Public API

### 4.1 Harness

```ts
class Harness<TState = Record<string, unknown>> {
  constructor(config: HarnessConfig<TState>);

  // Lifecycle
  init(): Promise<void>;
  shutdown(): Promise<void>;

  // Sessions — find-or-create across memory + storage. See §5.
  //
  // `session` resolves a session from any of three lookup shapes:
  //   - by sessionId (must already exist in memory or storage)
  //   - by (threadId, resourceId)  — find or create a session bound to that thread
  //   - by resourceId alone        — bootstrap: most-recent-or-create
  //
  // The returned `Session` is always live in memory. Storage is consulted
  // transparently when the session isn't already hydrated.
  //
  // All overloads enforce single-tenant scoping (see §2.3): if `resourceId` is
  // supplied, it is cross-checked against the stored record and a mismatch is
  // surfaced as `HarnessSessionNotFoundError` (sessions) or treated as
  // "doesn't exist" (threads). The ID-only overload is allowed for
  // single-tenant deployments; multi-tenant callers should always pass
  // `resourceId`.
  session(opts: { sessionId: string }): Promise<Session<TState>>;
  session(opts: { sessionId: string; resourceId: string }): Promise<Session<TState>>;
  session(opts: {
    threadId: string | { fresh: true };
    resourceId: string;
    sessionId?: string;
    parentSessionId?: string;       // mark this session as a child of another
  }): Promise<Session<TState>>;
  session(opts: { resourceId: string }): Promise<Session<TState>>;

  listSessions(opts: {
    resourceId: string;
    includeClosed?: boolean;
  }): Promise<SessionSummary[]>;

  closeSession(opts: { sessionId: string }): Promise<void>;

  // Threads (persistent storage primitive)
  threads: {
    create(opts: CreateThreadOptions): Promise<HarnessThread>;
    clone(opts: CloneThreadOptions): Promise<HarnessThread>;
    get(threadId: string): Promise<HarnessThread | null>;
    list(opts?: ListThreadsOptions): Promise<HarnessThread[]>;
    rename(threadId: string, title: string): Promise<void>;
    delete(threadId: string): Promise<void>;
    listMessages(threadId: string, opts?: ListMessagesOptions): Promise<HarnessMessage[]>;
    getFirstUserMessage(threadId: string): Promise<HarnessMessage | null>;
    getFirstUserMessages(threadIds: string[]): Promise<Record<string, HarnessMessage | null>>;
  };

  // Catalogs
  listModes(): HarnessMode[];
  listAvailableModels(): Promise<AvailableModel[]>;
  listSkills(): HarnessSkill[];
  getSkill(name: string): HarnessSkill | undefined;
  getToolCategory(opts: { toolName: string }): ToolCategory | null;
  getDefaultResourceId(): string;
  getKnownResourceIds(): Promise<string[]>;
  setDefaultModel(opts: { model: string }): void;

  // Intervals
  onInterval(handler: IntervalHandler): () => void;       // returns unsubscribe
  stopIntervals(): Promise<void>;

  // Cross-session events
  subscribe(listener: HarnessListener): () => void;

  // Workspace — out-of-session contexts only (init scripts, admin tooling, batch jobs).
  // Returns the shared workspace when the harness is configured with `kind: 'shared'`;
  // returns `undefined` for `per-resource` and `per-session` shapes.
  // Tools always go through `session.getWorkspace()` instead. See §2.7.
  getWorkspace(): Workspace | undefined;
  resolveWorkspace(): Promise<Workspace | undefined>;
  hasWorkspace(): boolean;
  isWorkspaceReady(): boolean;

  // Per-resource teardown. Throws if any session for `resourceId` is still live.
  // No-op for `shared` and `per-session` shapes. See §2.7.
  destroyResourceWorkspace(opts: { resourceId: string }): Promise<void>;

  // Infrastructure
  getMastra(): Mastra | undefined;
}
```

### 4.2 Session

```ts
class Session<TState = Record<string, unknown>> {
  readonly id: string;
  readonly resourceId: string;
  readonly threadId: string;
  readonly parentSessionId?: string;
  readonly createdAt: number;
  readonly lastActivityAt: number;

  // State.
  // In-process, `getState()` is a sync memory read served from the live
  // session under the lease. The remote variant (`RemoteSession`) exposes
  // the same name but returns `Promise<Readonly<TState>>`; portable code
  // using `RemoteSafeSession` should await it. See §2.6 and §13.5.
  // `setState` has two forms; the functional form is local-only.
  getState(): Readonly<TState>;
  setState(updates: Partial<TState>): Promise<void>;
  setState(updater: (prev: Readonly<TState>) => TState): Promise<void>;

  // Mode
  getCurrentModeId(): string;
  getCurrentMode(): HarnessMode;
  switchMode(opts: { mode: string }): Promise<void>;

  // Model
  getCurrentModelId(): string;
  hasModelSelected(): boolean;
  getCurrentModelAuthStatus(): Promise<ModelAuthStatus>;
  switchModel(opts: { model: string }): Promise<void>;
  setSubagentModel(opts: { agentType: string; model: string }): Promise<void>;
  getSubagentModel(opts: { agentType: string }): string | null;

  // Operations
  //
  // `message` — busy-independent. Delegates to the agent's `sendSignal()`.
  //   Idle thread → starts a new run. Active run → drains into the live loop
  //   as new user input. Multiple concurrent `message()` calls all deliver
  //   (Slack semantics). The returned promise resolves when the assistant
  //   turn answering *this* signal completes.
  //
  //   Never throws `HarnessBusyError`, but admission can still fail for
  //   reasons unrelated to busy-ness: `HarnessValidationError` (invalid
  //   options), `HarnessSessionClosedError`, `HarnessStorageError` (signal
  //   write failed), or `HarnessOverrideConflictError` when `model`, `mode`,
  //   or `addTools` are set on a signal that would drain into an
  //   already-active run (the run's surface is committed at start; a signal
  //   cannot mutate it mid-flight). See §4.3.
  //
  //   `stream: true` returns `AgentStream` synchronously (chunks of the
  //     turn that answers this signal).
  //   `output: schema` requires `sync: true`. The pair calls `agent.generate()`
  //     directly on a fresh `runId` and is the only `message` form that can
  //     throw `HarnessBusyError` (typed structured output needs a committed
  //     turn boundary, so it cannot interleave via signals).
  //
  // `queue` — busy-independent, defers delivery. Items append to a per-session
  //   FIFO held durably in `SessionRecord.pendingQueue`. When the thread
  //   reaches an idle boundary, head of queue is drained as a fresh
  //   standalone turn. Items run sequentially, one full turn each.
  //
  //   Never throws `HarnessBusyError`, but admission can fail with
  //   `HarnessValidationError` (including a runtime reject if `addTools` is
  //   present — queued items are durable and tool implementations are not
  //   serialisable; see §4.3 and §5.7), `HarnessSessionClosedError`,
  //   `HarnessStorageError`, or `HarnessQueueFullError` (when
  //   `sessions.maxQueueDepth` would be exceeded — see §9). The capacity
  //   check + durable append are atomic per session: two concurrent
  //   `queue()` calls cannot both commit past the cap.
  //
  // `useSkill` — fail-fast skill execution. Resolves the skill, builds the
  //   prompt with args injected, and delegates to `message`. Throws
  //   `HarnessBusyError` if the thread is busy.
  message(opts: MessageOptions & { stream: true }): AgentStream;
  message<S extends ZodSchema>(
    opts: MessageOptions<S> & { sync: true; output: S },
  ): Promise<z.infer<S>>;
  message(opts: MessageOptions): Promise<AgentResult>;

  queue(opts: QueueOptions): Promise<AgentResult>;

  useSkill<S extends ZodSchema | undefined = undefined>(
    name: string,
    opts?: UseSkillOptions<S>,
  ): Promise<S extends ZodSchema ? z.infer<S> : AgentResult>;

  // Skill discovery — applies the full resolution chain (code-registered,
  // then workspace-discovered). See §4.6.
  listSkills(): HarnessSkill[];
  getSkill(name: string): HarnessSkill | undefined;

  // Drop the cached workspace-discovery result. The next listSkills /
  // getSkill / useSkill call re-scans the workspace. Code-registered
  // skills are unaffected — they live on the harness and don't need
  // refreshing. Local-only: workspace discovery requires server-side
  // filesystem access, so refreshSkills is absent from RemoteSession.
  // See §4.6 and §13.5.
  refreshSkills(): Promise<void>;

  // Concurrency / inspection (read-only). Cancellation is not a session
  // concern in v1 — see §3.
  isBusy(): boolean;
  waitForIdle(opts?: { timeout?: number }): Promise<void>;
  getQueueDepth(): number;
  getCurrentRunId(): string | null;
  getCurrentTraceId(): string | null;

  // Messages
  listMessages(opts?: ListMessagesOptions): Promise<HarnessMessage[]>;
  setThreadSetting(opts: { key: string; value: unknown }): Promise<void>;

  // Display state
  getDisplayState(): Readonly<HarnessDisplayState>;
  subscribe(listener: HarnessListener): () => void;
  subscribeDisplayState(
    listener: (state: HarnessDisplayState) => void,
    opts?: { windowMs?: number },
  ): () => void;

  // Question / plan / tool resolution. Each `respond...` method consumes
  // the corresponding pending shape on `SessionRecord` (§5.1) — clears
  // the field, emits the matching display-state event, and resumes the
  // underlying Mastra workflow with the appropriate payload:
  //   respondToToolApproval   → consumes pendingApproval,    resumes with { approved, reason? }
  //   respondToToolSuspension → consumes pendingSuspension,  resumes with opaque resumeData
  //   respondToQuestion       → consumes pendingQuestion,    resumes with { answer }
  //   respondToPlanApproval   → consumes pendingPlan,        resumes with { approved, reason? }
  respondToToolApproval(opts: ToolApprovalResponse): void;
  respondToToolSuspension(opts: ToolSuspensionResponse): Promise<void>;
  registerQuestion(opts: RegisterQuestionOptions): void;
  respondToQuestion(opts: { answer: string | string[] }): void;
  registerPlanApproval(opts: RegisterPlanApprovalOptions): void;
  respondToPlanApproval(opts: { approved: boolean; reason?: string }): Promise<void>;

  // Permissions
  permissions: {
    grantCategory(opts: { category: ToolCategory }): void;
    grantTool(opts: { toolName: string }): void;
    revokeCategory(opts: { category: ToolCategory }): void;
    revokeTool(opts: { toolName: string }): void;
    getGrants(): Readonly<SessionGrants>;
    setPolicy(opts: { category: ToolCategory; policy: PermissionPolicy }): void;
    setPolicy(opts: { toolName: string; policy: PermissionPolicy }): void;
    getRules(): Readonly<PermissionRules>;
  };

  // Observational Memory
  om: {
    getObserverModelId(): string | null;
    getReflectorModelId(): string | null;
    getObservationThreshold(): number;
    getReflectionThreshold(): number;
    switchObserverModel(opts: { model: string }): Promise<void>;
    switchReflectorModel(opts: { model: string }): Promise<void>;
    getRecord(): Promise<ObservationalMemoryRecord | null>;
    loadProgress(): Promise<void>;
  };

  // Workspace — canonical access path for tools. Returns the workspace
  // belonging to this session under the harness's configured ownership model
  // (`shared` | `per-resource` | `per-session`). See §2.7.
  //
  // `getWorkspace()` is non-blocking; returns `undefined` if the workspace
  // hasn't been materialised yet (lazy mode). Use `resolveWorkspace()` to
  // force provisioning.
  getWorkspace(): Workspace | undefined;
  resolveWorkspace(): Promise<Workspace>;
  hasWorkspace(): boolean;
  isWorkspaceReady(): boolean;

  // Attachments — pre-upload bytes that can later be referenced by ID from
  // any message on this session. Useful for browser drag-drop with progress
  // UIs and large files. Inline attachments on `message`/`queue`/`useSkill`
  // are flushed here implicitly; this method just exposes the pre-upload path.
  // See §13.7.
  uploadAttachment(opts: {
    name: string;
    mimeType: string;
    data: Uint8Array;
    onProgress?: (loaded: number, total: number) => void;
  }): Promise<{ attachmentId: string }>;
  deleteAttachment(opts: { attachmentId: string }): Promise<void>;

  // Goals — persistent cross-turn objective with a judge model. After every
  // assistant turn that runs against this session, the configured judge
  // evaluates progress and decides `done`, `continue`, or `waiting`. A
  // `continue` decision auto-enqueues a continuation message via `queue(...)`,
  // so user follow-ups posted while the goal is running still preempt the
  // continuation cleanly. See §4.7.
  setGoal(opts: SetGoalOptions): GoalState;
  getGoal(): GoalState | null;
  pauseGoal(): GoalState | null;
  resumeGoal(): GoalState | null;
  clearGoal(): void;

  // Token usage
  getTokenUsage(): TokenUsage;

  // Lifecycle
  //
  // `close` is the ergonomic instance method for the common case where the
  // caller already has a `Session` reference. It delegates to
  // `harness.closeSession({ sessionId: this.id })`, which remains the
  // canonical implementation — call that form when you only have the ID
  // (e.g. iterating over `harness.listSessions(...)` summaries).
  close(): Promise<void>;
}
```

### 4.3 Per-turn overrides

Every entry point (`message`, `queue`, `useSkill`) accepts the same scoped overrides. The keys are `model` and `mode` — matching `Session#switchModel({ model })` and `Session#switchMode({ mode })` exactly. Whether you're setting durable session state or a one-turn override, the option name is the same.

```ts
interface HarnessOverrides {
  model?: string;          // Use a different model for this turn only
  mode?: string;           // Use a different mode for this turn only
  addTools?: ToolsetInput; // Add extra tools for this turn (merged on top, separate namespace)
  yolo?: boolean;          // Bypass approval prompts for this turn only
}
```

Overrides do not persist to thread metadata, do not emit `state_changed` events, and do not affect subsequent turns. They surface in the `agent_start` event under an optional `overrides` field for debuggability.

For `queue` items, overrides are stored on the queued entry in `SessionRecord.pendingQueue` and applied when that item's turn runs. **`addTools` is not allowed on `queue(...)`** — `QueueOptions` omits the field at the type level, and a runtime admission check rejects callers that pass it dynamically (wire-protocol body, cast, etc.) with `HarnessValidationError`. Queued items are durable and tool implementations are closures that don't round-trip through storage; accepting `addTools` here would mean a post-crash replay silently runs with a different tool surface than the caller requested. Callers who need a one-shot custom tool surface should use `message(...)` on an idle thread or `useSkill(...)`, where the override is bound to a run that exists for its full lifetime in memory.

**Overrides bind to a turn boundary, not to user input.** A per-turn override is a property of the *agent run* the entry point starts. The run surface — which model is talking, which mode shapes the system prompt, what tool surface is exposed — is committed when the run starts and is invariant for that run's lifetime. Signals only let user content interleave into a live run; they do *not* let the surface mutate underneath the model. This matters because `message()` has two delivery modes:

| Delivery mode | Override behaviour |
| --- | --- |
| `message()` lands while the thread is **idle** → starts a new run | Overrides apply to that run, exactly as they do for `queue` and `useSkill`. |
| `message()` drains as user input into an **already-active** run | The run's surface was already committed; the signal cannot retroactively change `model`, `mode`, or `addTools`. |
| `queue()` item, drained later as a fresh standalone turn | Overrides apply to that item's run when it eventually drains (see above). |
| `useSkill(...)` | Always starts a fresh run; overrides apply normally. |

For `message()` in the second row, the harness's behaviour depends on whether the call carries overrides:

- **No overrides** — accepted normally. The signal is delivered, the user content interleaves into the live run, the run keeps its committed surface. This is the common case.
- **`yolo` only** — accepted. `yolo` is an admission-time policy gate on approval prompts (the next prompt this signal causes the model to emit), not a property of the run surface, so it is honoured without disturbing the live run.
- **Any of `model`, `mode`, `addTools` set** — admission-time reject with `HarnessOverrideConflictError`. The run cannot honour the override and silently dropping it would be a footgun. The caller decides what to do: drop the override and resend; abort the live run via the agent-layer surface (see §3 — there is no `session.abort()` in v1) and resend (the next signal will start a fresh run with the override applied); or — for `model` / `mode` only — call `session.queue(...)` so the override applies to the queued standalone turn. `queue(...)` rejects `addTools` of its own accord (see below), so callers who specifically need a one-shot tool surface have to wait for the live run to end and resend via `message(...)` on idle, or use `useSkill(...)`.

The check looks at the run that this *specific signal* would deliver into, not at the session generally — so once the live run finishes and the next `message()` lands on an idle thread, overrides apply normally again. The run's committed surface is reported on `agent_start.overrides` so subscribers can see what the active run is using.

**Linearisation.** "Active run" is determined at admission, under the same per-session ordering that linearises signal delivery (§5.8 write lease). A run that finishes between the user's call and harness admission would have left the thread idle by the time admission happens, and overrides apply to the new run started by this signal. There is no window in which the harness admits a signal believing the thread is idle and then drops it into a run that started concurrently: the agent layer's signal queue and the harness's admission check are ordered by the same lease.

### 4.4 Operation option types

The three operation primitives share a common shape. All extend `HarnessOverrides`.

```ts
interface MessageOptions<S extends ZodSchema | undefined = undefined> extends HarnessOverrides {
  content: string;
  files?: FileAttachment[];
  // `output` requires `sync: true`. Together they call agent.generate() on
  // a fresh runId and bypass the signal pathway (typed extraction needs a
  // committed turn boundary). This is the only message form that can throw
  // HarnessBusyError.
  output?: S;
  sync?: boolean;
  // `stream: true` returns AgentStream synchronously. The stream represents
  // the turn that answers this signal. Mutually exclusive with `output`.
  stream?: boolean;
  requestContext?: RequestContextInput;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

// `QueueOptions` deliberately omits `addTools`. Queued items are durable —
// they survive server restarts and replay from `SessionRecord.pendingQueue`
// — and tool implementations are closures that cannot be serialised. Letting
// callers pass `addTools` here would mean the post-restart replay runs with
// a different tool surface than the caller requested, silently. Callers that
// need a custom tool surface for a one-shot turn should use `message(...)`
// on an idle thread (or `useSkill(...)`), where the override is bound to a
// run that lives in memory for its full lifetime. See §4.3 and §5.7.
interface QueueOptions extends Omit<HarnessOverrides, 'addTools'> {
  content: string;
  files?: FileAttachment[];
  requestContext?: RequestContextInput;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

interface UseSkillOptions<S extends ZodSchema | undefined = undefined> extends HarnessOverrides {
  args?: Record<string, unknown>;   // injected into the skill prompt
  files?: FileAttachment[];
  output?: S;                       // typed result
  requestContext?: RequestContextInput;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

// File attachments. Two forms:
//   - Inline: bytes in-memory, harness flushes them to the attachment store
//     before queuing (so the queue item survives a server restart).
//   - URL: already-hosted asset (S3, signed CDN URL, etc.); stored as-is.
//
// Pre-uploaded inline files reference a previously-stored attachment by ID
// (see HarnessStorage.saveAttachment in §5.2 and the wire protocol in §13).
type FileAttachment =
  | {
      kind: 'inline';
      name: string;
      mimeType: string;
      data: Uint8Array;
    }
  | {
      kind: 'url';
      name: string;
      mimeType: string;
      url: string;
    }
  | {
      kind: 'ref';
      name: string;
      mimeType: string;
      attachmentId: string;            // reference to a previously-stored attachment
    };
```

Inline attachments larger than `HarnessConfig.files.maxInlineBytes` (default 10 MiB; see §9) are rejected at the entry point — callers must pre-upload via the file route or use a URL form.

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

### 4.6 Skills

A **skill** is a named, parameterised prompt invoked via `session.useSkill(name, opts)`.

**Skills are session-scoped.** A skill is "available" only when a specific session can resolve its name. Two sources feed that resolution:

- **Code-registered skills** (`HarnessConfig.skills`) — static, deployment-wide, the same for every session under this harness. These are about what your *product* offers (e.g. MastraCode shipping `summarize-pr`, or Devin shipping `clone-and-explore`).
- **Workspace skills** — discovered from the session's workspace at `.claude/skills/<name>/SKILL.md`. These are about what your *project* offers (e.g. a repo shipping `lint-and-format` or `e2e-tests-studio` checked into source control). Whether two sessions share the same set depends on the workspace ownership model (§2.7): a `shared` workspace gives every session the same workspace skills; a `per-resource` workspace partitions them by tenant; a `per-session` workspace gives each session its own.

A session is the thing that has both a harness identity and a workspace identity, so a session is where the two sources meet. The harness has no "execute a skill" method — there's no session for it to execute against. `session.useSkill(name)` is the only invocation surface.

```ts
interface HarnessSkill {
  name: string;                                // Lookup key for `useSkill`
  description: string;                         // Shown in tool catalogues / UIs
  instructions: string;                        // The prompt body. May reference args.
  argsSchema?: ZodSchema;                      // Optional validation for `useSkill({ args })`
  outputSchema?: ZodSchema;                    // Optional default output schema. The
                                               //   per-call `output` option still wins.
  defaultMode?: string;                        // Optional mode override applied for the call
  source: 'config' | 'workspace';              // Origin (set by the harness, not the author)
  filePath?: string;                           // Set when `source === 'workspace'`
}
```

**Resolution.** When `session.useSkill('triage')` is called, the harness resolves the name as follows:

1. **Code-registered skills** (`HarnessConfig.skills`) take precedence. Match by exact `name`.
2. **Workspace-discovered skills** are checked next. The harness scans the session's workspace (if any) for `.claude/skills/<name>/SKILL.md` and loads the first match.
3. If neither resolves, `useSkill` throws `HarnessSkillNotFoundError`.

This precedence rule means a deployment can override a workspace skill by registering one of the same name in code — useful for hotfixes, testing, or pinning a specific version when the workspace's skill is in flux.

**Workspace discovery.**

- Discovery runs on first `useSkill` or `session.listSkills()` call per session, and is cached for the session's lifetime by default. Files added, removed, or edited in the workspace after that point are not visible until the cache is dropped.
- The in-session refresh path is `await session.refreshSkills()`. It clears the cached scan; the next `listSkills` / `getSkill` / `useSkill` call re-runs workspace discovery. Code-registered skills are not affected — they're held on the harness, not on the session, and never go stale. A TUI exposing a "reload skills" command should call this; long-running server sessions can call it on a workspace-mutation hook (e.g. after a `git pull` in a `shared` workspace, or when a file watcher reports a change under `.claude/skills/`).
- `refreshSkills` is local-only. Workspace discovery requires server-side filesystem access, so the method is absent from `RemoteSession` (§13.5). A remote client that wants the same effect should ask the server for it through a product-specific route, or close and re-open the session.
- The skill file format mirrors Anthropic's skill spec: a YAML frontmatter block with `name` + `description`, followed by a Markdown body containing the instructions.
- Files outside `.claude/skills/<name>/SKILL.md` are ignored. There is no recursion into subdirectories beyond `<name>/`.
- If the session has no workspace, only code-registered skills are available.

**Args injection.** When a skill is invoked with `args`, the harness builds the prompt by appending a JSON code block to the skill's `instructions` body (no special delimiters). Skill authors should reference the args naturally in their Markdown — e.g. *"Use the values in the JSON block below to..."*.

**Inspection — two surfaces with different scopes.**

- **Harness surface** — registry view of code-registered skills only. Useful for "what does this product/deployment ship?" (e.g. surfacing built-ins in marketing, build-time validation, dashboards). Says nothing about what any specific session can actually run.
  - `harness.listSkills(): HarnessSkill[]`
  - `harness.getSkill(name: string): HarnessSkill | undefined`
- **Session surface** — full resolution view (code-registered ∪ workspace-discovered, with code wins on name collision). This is the "what can this session actually invoke?" answer, and matches what `useSkill` will resolve.
  - `session.listSkills(): HarnessSkill[]`
  - `session.getSkill(name: string): HarnessSkill | undefined`

In a single-user TUI with a `shared` workspace, harness and session views differ only by the workspace skills. In a multi-tenant deployment with `per-resource` or `per-session` workspaces, the harness view stays constant across sessions while session views differ — exactly the point of session-scoping.

### 4.7 Goals

A **goal** is a standing objective attached to a session that survives across turns. While a goal is active, after every assistant turn the harness invokes a separate **judge model** to evaluate the latest exchange and decide what to do next:

- **`done`** — the goal is satisfied. The harness emits `goal_done` and stops the loop.
- **`continue`** — the goal is not yet satisfied. The harness enqueues the judge's `reason` as a continuation message via `session.queue(...)`. The continuation runs after any user-supplied messages already in the queue, so user follow-ups always preempt automatic continuations.
- **`waiting`** — the goal is at an explicit human checkpoint. The loop stops auto-continuing but stays active. The next user `message(...)` resumes progress; the judge re-evaluates after the response.

Goals are inspired by the Ralph-loop pattern (Hermes `/goal`, Codex `/goal`). The harness ships them as a first-class primitive because every consumer that has tried to layer them on top of `subscribe` + `queue` has rebuilt the same race conditions (stale judge results, drained queues firing continuations against cleared goals, paused goals being resumed mid-judge).

```ts
interface GoalState {
  id: string;
  objective: string;
  status: 'active' | 'paused' | 'done';
  turnsUsed: number;
  maxTurns: number;
  judgeModelId: string;
  judgeAnswersQuestions: boolean;
  lastDecision?: GoalJudgeDecision;
  createdAt: number;
}

interface GoalJudgeDecision {
  decision: 'done' | 'continue' | 'waiting';
  reason: string;
  judgedAt: number;
}

interface SetGoalOptions {
  objective: string;
  judgeModel?: string;            // Default: harness `goals.defaultJudgeModel`
  maxTurns?: number;              // Default: 50
  judgeAnswersQuestions?: boolean; // Default: false. When true, the judge auto-answers
                                  // `ask_user` prompts during goal mode so the assistant
                                  // can keep working unless the goal explicitly demands
                                  // a human checkpoint.
}
```

**Lifecycle.**
1. `session.setGoal({ objective, judgeModel, maxTurns })` — replaces any existing goal, resets the turn counter, persists to `SessionRecord.goal`. Emits `goal_set`.
2. After each assistant turn the session drives, the harness reads `getGoal()`. If status is `'active'`:
    - Calls the judge model with the recent conversation context and the goal objective.
    - If the goal was paused, cleared, or replaced *during* judging, the result is discarded silently. (The TUI implementation learned this the hard way; lifting the manager into the harness lets us own the invariant.)
    - Emits `goal_judged` with the decision.
    - Acts on the decision: enqueues a continuation, marks done, or stops at the human checkpoint.
3. `session.pauseGoal()` / `resumeGoal()` — stop or restart auto-continuations without losing the goal. Emits `goal_paused` / `goal_resumed`.
4. `session.clearGoal()` — drops the goal entirely. Emits `goal_cleared`.

**Preemption.** The judge always runs as a side effect of an assistant turn. Continuation messages are *enqueued*, not sent inline — so anything the user has typed-ahead via `queue(...)` runs first. A user `message(...)` posted while the judge is still evaluating is accepted and signals into the live run as usual; the judge's eventual continuation lands behind any new user input.

**Budget.** `maxTurns` (default 50) is checked *after* each judge call so the final turn is never denied a verdict. When the budget is exhausted, the harness sets status to `'paused'` and emits `goal_paused` with reason `'budget_exhausted'`. Callers can raise `maxTurns` and call `resumeGoal()` to keep going.

**Failures.** If the judge model fails (network error, structured-output validation failure, schema mismatch), the harness fails closed: the goal is moved to `'paused'`, an `error` event fires with the cause, and no continuation is enqueued. This avoids a hot loop of retries against a flaky judge.

**Subagents.** Subagent sessions do *not* inherit the parent's goal. Subagents are explicitly bounded units of work that already terminate when the inner task is done. If a subagent should also drive a sub-goal, the parent tool can call `subagentSession.setGoal(...)` after spawning.

**Persistence.** `GoalState` lives in `SessionRecord.goal` (see §5.1). It survives crashes, server restarts, and session re-hydration. A judge call that was in flight when the process died is *not* resumed — the harness re-evaluates from the most recent assistant turn the next time the session becomes active. This keeps the resume path simple and avoids leaking partial judge state into storage.

**Scope.** Sessions hold at most one goal. Setting a new goal while one is active replaces it (and emits `goal_cleared` then `goal_set`). Nested goals are not in v1; if you need them, set the goal on a child session.

---

## 5. Session persistence

Sessions are durable. The runtime `Session` object is a hydrated cache of a `SessionRecord` row stored in `MastraStorage` under a new `harness` domain.

This makes the Harness usable in three deployment shapes without changing the surface:
- **Single-user TUI** — one process, one user, sessions resume across restarts.
- **Multi-tenant server** — many users, many concurrent sessions; clients hold a session ID and reconnect across requests.
- **Mobile/web with intermittent connectivity** — phone disconnects, server flushes, laptop picks up where the phone left off.

### 5.1 What gets persisted

```ts
interface SessionRecord {
  id: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;          // subagent linkage

  // Per-turn defaults
  modeId: string;
  modelId: string;
  subagentModelOverrides: Record<string, string>;

  // Permissions
  permissionRules: PermissionRules;
  sessionGrants: SessionGrants;

  // Counters
  tokenUsage: TokenUsage;

  // In-flight state (resumable across restarts).
  // `pendingQueue.length` is bounded by `sessions.maxQueueDepth` (§9). The
  // capacity check and the durable append are linearised under the session's
  // write lease (§5.8); admission past the cap rejects with
  // `HarnessQueueFullError` before touching storage.
  pendingQueue: QueuedItem[];
  pendingApproval?: PendingApproval;
  pendingSuspension?: PendingToolSuspension;
  pendingQuestion?: PendingQuestion;
  pendingPlan?: PendingPlanApproval;

  // Observational memory config
  observationalMemory?: {
    observerModelId?: string;
    reflectorModelId?: string;
  };

  // Active goal — set via `session.setGoal(...)`, evaluated after each
  // assistant turn. See §4.7.
  goal?: GoalState;

  // Per-session workspace state (only populated under `kind: 'per-session'`
  // with a `resumable: true` provider). `providerId` is the registered
  // provider's stable identity (e.g. 'e2b', 'daytona', 'modal'); `state` is
  // the opaque blob the provider reports via the workspace's state-update
  // hook and is fed back to `provider.resume({ state, ... })` after a
  // server restart. Providers must declare `resumable` statically; the
  // harness rejects `kind: 'per-session'` against `resumable: false` providers
  // at `init()`, before any sandbox is provisioned. See §2.7 and §9.
  workspace?: {
    providerId: string;
    state: unknown;
  };

  // User-defined custom state (typed via TState generic on Harness)
  state: unknown;

  // Lifecycle
  createdAt: number;
  lastActivityAt: number;
  closedAt?: number;

  // Write-concurrency — see §5.8.
  version: number;            // Monotonically incremented on every successful saveSession.
                              //   Used for optimistic-CAS conflict detection.
  ownerId?: string;           // ownerId of the Harness instance currently holding the lease,
                              //   or undefined if the record is unowned (no live Session).
  leaseExpiresAt?: number;    // Epoch ms — when the current lease TTLs out. Adapters that
                              //   provide a native lease primitive may store this implicitly.
}

interface SessionSummary {
  id: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  lastActivityAt: number;
  closedAt?: number;
}

// `pendingQueue` holds items added via `session.queue(...)` only.
// Items added via `session.message(...)` are NOT persisted here — they go
// straight to `agent.sendSignal(...)` and durability post-acceptance is owned
// by the agent layer (signals are durable by design, with stable IDs and
// replay prevention). Pre-acceptance crashes lose the message; the user
// resends. Slack semantics.
//
// Inline-form FileAttachments are flushed to HarnessStorage.saveAttachment(...)
// before the item is persisted, so the queue contains only references — never
// raw bytes.
interface QueuedItem {
  id: string;                       // unique per session, used for ack/cancel
  enqueuedAt: number;
  content: string;
  attachments: PersistedAttachment[];
  // Per-turn overrides, captured at enqueue time
  model?: string;
  mode?: string;
  yolo?: boolean;
  // `addTools` is intentionally absent — tool implementations are closures
  // and cannot be serialised. The corresponding option is rejected at
  // `queue(...)` admission with `HarnessValidationError` (both at the type
  // level via `Omit<HarnessOverrides, 'addTools'>` and at runtime), so a
  // queued item never carries a request for a tool surface it cannot
  // honour after a crash. Callers who need a one-shot custom tool surface
  // should use `message(...)` on an idle thread or `useSkill(...)`. See
  // §4.3.
}

type PersistedAttachment =
  | { kind: 'ref'; name: string; mimeType: string; attachmentId: string }
  | { kind: 'url'; name: string; mimeType: string; url: string };

// Permissions — plain JSON, no functions, no closures.
interface PermissionRules {
  categories: Record<string, 'allow' | 'deny' | 'ask'>;  // per-category default
  tools: Record<string, 'allow' | 'deny' | 'ask'>;       // per-tool override (wins)
}

interface SessionGrants {
  categories: string[];   // granted for the lifetime of this session only
  tools: string[];
}

// All four "pending" shapes correlate a Mastra agent suspension with
// session-scoped UX. The actual paused execution state lives in the workflow
// snapshot under `MastraStorage.workflows`, keyed by `runId`. The harness only
// stores enough to rebuild the UX and resume:
//
//   await agent.resumeStream(resumeData, { runId });
//
// The shapes are deliberately distinct because the resume payloads are
// distinct: an approval gate carries `{ approved, reason? }`; a tool
// suspension carries opaque `resumeData` that flows back into the paused
// tool's continuation; a question carries the user's answer; a plan
// approval carries `{ approved, reason? }` and may flip the session's mode.
// `source` distinguishes whether the suspension came from the parent session's
// own turn or from a subagent — drives state-isolation rules in §8.

interface PendingApproval {
  kind: 'tool-approval';            // gate: model wants to call a tool, user decides yes/no
  runId: string;
  toolCallId: string;
  toolName: string;
  toolCategory?: string;            // enables "approve category" UX
  input: unknown;                   // serialised tool input
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

interface PendingToolSuspension {
  kind: 'tool-suspension';          // mid-execution: tool ran, called suspend(data), waiting for external resume
  runId: string;
  toolCallId: string;
  toolName: string;
  // The tool's serialised `suspend(...)` payload — what the tool author
  // chose to expose to the resumer (e.g. `{ webhookUrl, expectedSignature }`).
  // Opaque to the harness; rendered by the UI / handed to the external
  // system that produces the resume payload.
  suspendData: unknown;
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

interface PendingQuestion {
  kind: 'question';
  runId: string;
  toolCallId: string;               // ask_user tool's call id
  question: string;
  options?: { label: string; description?: string }[];
  selectionMode?: 'single_select' | 'multi_select';
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

interface PendingPlanApproval {
  kind: 'plan-approval';
  runId: string;
  toolCallId: string;               // submit_plan tool's call id
  title: string;
  plan: string;                     // markdown body
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}
```

Transient runtime state (`AbortController`, in-flight model-call promises, SSE listeners, the live `DisplayStateScheduler`, the `pendingApprovalResolve` callback) is **not** persisted. It's reconstructed when a record is hydrated; pending suspensions are resumed by handing `runId` back to `agent.resumeStream(...)` / `agent.resumeGenerate(...)`.

**Serialization contract.** Every field on `SessionRecord` must be JSON-serializable. The shapes above are deliberately closed: no functions, no class instances, no `Map`/`Set`/`Date` objects (use ISO strings or epoch numbers, as shown). Inline-form file attachments are normalised to `PersistedAttachment` references before they reach the record. The non-serialisable per-turn override (`addTools`) does not appear on `QueuedItem` because `queue(...)` rejects it at admission rather than dropping it silently after the fact — see §4.3 and the comment on `QueuedItem` above.

**`state: TState` constraint.** The user-defined `state` slot must round-trip through `JSON.stringify` / `JSON.parse`. The harness validates this on every flush and rejects non-serializable values with `HarnessStateSerializationError`. Recommended: keep `state` small (rule of thumb: under 64 KiB). Large blobs belong in workspace files, file attachments, or your own datastore — referenced from `state` by ID.

### 5.2 Storage shape

`MastraStorage` gains a `harness` domain:

```ts
interface MastraStorage {
  // ...existing domains (agents, memory, workflows, ...)...

  harness: {
    // Threads (already specified — moved here under the harness domain)
    // Threads. Like `loadSession`, the direct-ID primitives do NOT enforce
    // resource scoping — the harness layer cross-checks each record's
    // `resourceId` before returning to a caller (see §2.3). `listThreads`
    // takes `resourceId` as part of `ListThreadsOptions` and is expected to
    // filter at the storage layer for efficiency.
    saveThread(record: HarnessThread): Promise<void>;
    loadThread(opts: { threadId: string }): Promise<HarnessThread | null>;
    listThreads(opts: ListThreadsOptions): Promise<HarnessThread[]>;
    deleteThread(opts: { threadId: string }): Promise<void>;

    // Messages
    appendMessages(opts: { threadId: string; messages: HarnessMessage[] }): Promise<void>;
    listMessages(opts: { threadId: string } & ListMessagesOptions): Promise<HarnessMessage[]>;

    // Sessions (new in v1)
    saveSession(
      record: SessionRecord,
      opts: { ownerId: string; ifVersion: number },
    ): Promise<{ version: number }>;

    // Direct ID lookup. Returns the record regardless of `closedAt` — this is
    // the path that powers history APIs and `harness.session({ sessionId })`
    // (which throws `HarnessSessionClosedError` for closed records — see §5.5).
    //
    // This primitive does NOT enforce resource scoping; it returns whatever
    // record matches the ID. The harness layer cross-checks `resourceId`
    // against the returned record before surfacing it to a caller and throws
    // `HarnessSessionNotFoundError` on mismatch (see §2.3). Adapters do not
    // need to implement tenancy themselves.
    loadSession(opts: { sessionId: string }): Promise<SessionRecord | null>;

    // Lookup by (thread, resource). Returns only **active** records, defined
    // as `closedAt === undefined`. Returns `null` when no active record exists,
    // even if one or more closed records match the (threadId, resourceId) pair.
    // This is what makes `harness.session({ threadId, resourceId })` create a
    // fresh session after a previous one was closed (see §5.3).
    // If multiple active records exist for the pair (a degenerate state — the
    // harness never produces this, but operator tooling might), implementations
    // return the most recent by `lastActivityAt`.
    loadSessionByThread(opts: { threadId: string; resourceId: string }): Promise<SessionRecord | null>;

    // Listing. Closed records are excluded by default; pass `includeClosed: true`
    // to surface them for history / audit views.
    listSessions(opts: { resourceId: string; includeClosed?: boolean }): Promise<SessionSummary[]>;

    deleteSession(opts: { sessionId: string }): Promise<void>;

    // Session leases (new in v1) — see §5.8 for the write-concurrency contract.
    acquireSessionLease(opts: {
      sessionId: string;
      ownerId: string;
      ttlMs: number;
    }): Promise<{ version: number; expiresAt: number }>;
    renewSessionLease(opts: {
      sessionId: string;
      ownerId: string;
      ttlMs: number;
    }): Promise<{ version: number; expiresAt: number }>;
    releaseSessionLease(opts: {
      sessionId: string;
      ownerId: string;
    }): Promise<void>;

    // File attachments (new in v1).
    // Inline-form attachments on queued / suspended messages are flushed here
    // before the queue item is persisted, then deleted after the message is
    // consumed. Implementations may back this with a separate blob store.
    saveAttachment(opts: {
      sessionId: string;
      attachmentId: string;
      name: string;
      mimeType: string;
      data: Uint8Array;
    }): Promise<void>;
    loadAttachment(opts: {
      sessionId: string;
      attachmentId: string;
    }): Promise<{ name: string; mimeType: string; data: Uint8Array } | null>;
    deleteAttachment(opts: {
      sessionId: string;
      attachmentId: string;
    }): Promise<void>;
    deleteAttachmentsForSession(opts: { sessionId: string }): Promise<void>;
  };
}
```

Implementations: in-memory (testing), filesystem (TUI), Postgres / SQLite / DurableObjects / Redis (servers). Same plug-in pattern as the rest of `MastraStorage`. Attachment bytes are typically not co-located with row data — adapters are free to delegate to S3 / R2 / local disk under the same interface.

### 5.3 Resolution semantics

The `harness.session(...)` resolver runs find-in-memory → find-in-storage → create:

| Input | Live in memory? | Record in storage? | Result |
|---|---|---|---|
| `{ sessionId }` | yes | n/a | return live instance |
| `{ sessionId }` | no | yes (active) | hydrate record, return |
| `{ sessionId }` | no | yes (closed) | throw `HarnessSessionClosedError` |
| `{ sessionId }` | no | no | throw `HarnessSessionNotFoundError` |
| `{ sessionId, resourceId }` | yes, `resourceId` matches | n/a | return live instance |
| `{ sessionId, resourceId }` | yes, `resourceId` mismatches | n/a | throw `HarnessSessionNotFoundError` |
| `{ sessionId, resourceId }` | no | yes, `resourceId` matches, active | hydrate, return |
| `{ sessionId, resourceId }` | no | yes, `resourceId` matches, closed | throw `HarnessSessionClosedError` |
| `{ sessionId, resourceId }` | no | yes, `resourceId` mismatches | throw `HarnessSessionNotFoundError` (do not leak existence) |
| `{ sessionId, resourceId }` | no | no | throw `HarnessSessionNotFoundError` |
| `{ threadId, resourceId }` | yes | n/a | return live instance |
| `{ threadId, resourceId }` | no | active record exists, thread `resourceId` matches | hydrate record, return |
| `{ threadId, resourceId }` | no | only closed record(s) exist for matching resource | create a **fresh** record + return (closed records do not block reuse of the thread) |
| `{ threadId, resourceId }` | no | thread exists but belongs to a **different** resource | treat as "thread does not exist" — create a fresh thread + fresh session under the caller's `resourceId` (do not leak the existing thread) |
| `{ threadId, resourceId }` | no | no | create record + thread (if missing), return |
| `{ threadId: { fresh: true }, resourceId }` | n/a | n/a | always create a fresh thread + fresh session |
| `{ resourceId }` | n/a | active record exists | hydrate most-recent active for that resource, return |
| `{ resourceId }` | n/a | only closed records exist for that resource | create fresh thread + fresh session |
| `{ resourceId }` | n/a | no | create fresh thread + fresh session |

The thread-and-resource lookup deliberately ignores closed records. A common flow — finish a session, close it, then start a new one on the same thread — must produce a fresh active session. Storage adapters enforce this in `loadSessionByThread(...)` (see §5.2): the method returns `null` when only closed records match, even if a closed record exists. Closed records are still reachable through `loadSession({ sessionId })` and `listSessions({ includeClosed: true })` for history and audit views.

`{ sessionId, threadId, resourceId }` (all three) is the multi-tenant-server pattern: caller computes a deterministic session ID from `(user, thread)` and asks for that session. Resolves to the live instance, hydrates from storage if needed (active records only), or creates a fresh record with that ID bound to the thread. A closed record at that ID still throws `HarnessSessionClosedError` — deterministic IDs and closure are mutually exclusive (the caller picks a new ID or rotates the thread).

### 5.4 Memory residency and eviction

The Harness keeps a configurable cap on live sessions to bound memory. When the cap is exceeded or a session has been idle past the configured timeout:

1. The in-memory `Session` flushes any dirty state to storage.
2. The instance is dropped from the live map.
3. The record stays in storage with `closedAt: undefined`.
4. The next `harness.session({ sessionId })` call re-hydrates transparently.

**Pending interrupts pin the session in memory.** A session is *not* eligible for idle-timeout eviction while any of `pendingApproval`, `pendingSuspension`, `pendingQuestion`, or `pendingPlan` is set. Evicting a session that is parked on a human-in-the-loop prompt would silently kill an active stream the moment the user gets distracted. The pin lifts as soon as the prompt is answered (or the session is explicitly closed). Note that pressure-based eviction via `sessions.maxLive` still applies — pinning only protects against time-based idle eviction.

Eviction is invisible to callers. They always get a working `Session` from `harness.session(...)`; whether it was already in memory or just hydrated is an implementation detail.

Configuration knobs (see §9):
- `sessions.maxLive` — cap on hydrated sessions (default `Infinity` — no cap; opt in to a finite cap if you need eviction-by-pressure).
- `sessions.idleTimeoutMs` — auto-evict after this period of no activity (default `2 hours`). The check is skipped while a session has a pending approval/suspension/question/plan.
- `sessions.flushDebounceMs` — debounce window for writing dirty state (default `500ms`).

### 5.5 Lifecycle

A session record is in one of three states:

- **Active (resumable).** `closedAt: undefined`. May or may not be live in memory.
- **Closed.** `closedAt: <timestamp>`. Cannot be hydrated. `harness.session({ sessionId })` throws `HarnessSessionClosedError`.
- **Deleted.** Record removed from storage.

Transitions:

- `session.close()` (or `harness.closeSession({ sessionId })` when you only have the ID) — flushes, evicts from memory, sets `closedAt`. Final.
- `harness.threads.delete({ threadId })` — cascades: closes and deletes all sessions bound to that thread.
- Idle eviction — moves between "active in memory" and "active in storage only," never touches `closedAt`.

**Closed records and thread reuse.** A thread can outlive any single session that ran on it. After `session.close()` the thread is still a valid target for a new session: `harness.session({ threadId, resourceId })` ignores the closed record and creates a fresh active session bound to the same `threadId` (see §5.3). Closed records remain in storage as history — addressable by `harness.session({ sessionId })` (which throws `HarnessSessionClosedError`), surfaced by `harness.listSessions({ resourceId, includeClosed: true })`, and removed only by an explicit `harness.deleteSession(...)` or by `harness.threads.delete(...)` cascading.

Detach (proactively flush + drop without closing) is not exposed in v1. It happens implicitly via eviction. If real callers want explicit control later, we add `harness.detachSession({ sessionId })` in a minor.

### 5.6 Subagent sessions

A subagent session is a normal `SessionRecord` with `parentSessionId` set. It persists like any other session. This means:

- Subagent state survives restarts the same way parent state does.
- Walking `parentSessionId` rebuilds the subagent tree without needing in-memory state.
- Subagent sessions are visible in `listSessions(...)` (filterable by `parentSessionId` if needed; not in v1).

Subagent depth (§8) is computed from the chain of `parentSessionId` records, not from a runtime counter — so the cap holds across restarts.

### 5.7 Failure and crash recovery

Persistence is what makes sessions resumable across server restarts and storage hiccups. This section spells out what survives, what doesn't, and what callers can rely on.

**Flush points.** Writes to storage happen in two flavours:

- **Synchronous (durable transitions).** Queue append, approval / suspension / question / plan registration, mode or model switch, attachment upload, `closeSession`. The originating call only resolves once the write is committed. If the write fails, the call rejects with `HarnessStorageError` and the in-memory mutation is rolled back so the live `Session` and the persisted record stay in agreement.
- **Debounced (non-critical).** Token usage, `lastActivityAt`, display-state snapshots, periodic OM bookkeeping. Coalesced on the `sessions.flushDebounceMs` window. Failures are logged and retried with exponential backoff. After `sessions.maxFlushFailures` consecutive failures (default `5`), the session emits an `error` event and starts rejecting durable operations with `HarnessStorageError` until storage recovers — input is *not* silently buffered in memory.

**Rehydration failures.**

- *Forward-compatible schema drift.* Unknown fields on a stored `SessionRecord` are preserved as-is and rewritten on the next flush. New optional fields added by a later harness version don't break older records.
- *Backward-incompatible schema.* If a required field is missing or malformed, `harness.session(...)` throws `HarnessSessionCorruptError` with `reason: 'schema_incompatible'`. The record is left in storage; callers decide whether to repair or `harness.deleteSession({ sessionId, force: true })`.
- *Corrupted JSON.* Throws `HarnessSessionCorruptError` with `reason: 'parse_failed'`.
- *Pending interrupt with a missing workflow snapshot.* The session hydrates successfully, the corresponding `pendingApproval` / `pendingSuspension` / `pendingQuestion` / `pendingPlan` field is dropped, and an `error` event fires explaining that the suspended turn could not be resumed. The queue continues from the next item. Rationale: replicating the agent layer's `AGENT_RESUME_NO_SNAPSHOT_FOUND` at hydration time would brick the session for a recoverable mismatch (e.g. a snapshot TTL'd out, a workflow store rebuilt).

**Crash mid-turn.** What a freshly hydrated session looks like depends on where the crash hit and which primitive originated the input:

| Crash point | After hydration |
|---|---|
| `message(...)` in flight, signal not yet accepted by the agent | **Lost.** The message was never persisted (Slack semantics — `message` items aren't on `pendingQueue`). The caller's pending promise rejects. The user resends if they want the message delivered. |
| `message(...)` accepted, run started, no suspension | Agent-layer durability: the signal is recorded in the agent's thread log. On hydration, the harness re-attaches via `agent.subscribeToThread(...)`. If the run completed before crash, the assistant turn is in the thread log. If it didn't, the model output is lost — but the user-side input survives in the thread log so they can ask again. |
| `queue(...)` enqueued but not yet drained | Durable. Item still on `pendingQueue`. On the next `harness.session(...)` and once the thread is idle, the head is drained (signalled) as a fresh standalone turn. |
| `queue(...)` drained and signalled, run mid-flight | At-least-once. The item is removed from `pendingQueue` *after* the turn completes. If the crash hit before completion, the item re-runs on hydration. Tools that are not idempotent should guard themselves; `QueuedItem.id` is exposed for de-duping. |
| Suspended on tool approval | `pendingApproval` is rehydrated. The workflow snapshot in `MastraStorage.workflows` survives the crash (it's owned by the agent layer, not the harness). The user responds via `respondToToolApproval(...)`; harness calls `agent.resumeStream({ approved, reason }, { runId })`. |
| Suspended on tool execution (`suspend(data)`) | `pendingSuspension` is rehydrated — the *separate* persisted shape (§5.1), not a relabelled `pendingApproval`. The workflow snapshot survives. The external resumer (webhook handler, operator, …) calls `respondToToolSuspension({ toolCallId, resumeData })`; harness calls `agent.resumeStream(resumeData, { runId })`. The `resumeData` payload is opaque to the harness and flows straight back into the paused tool's continuation. |
| `ask_user` outstanding | `pendingQuestion` is rehydrated. Responding via `respondToQuestion(...)` resumes the underlying agent turn. |
| `submit_plan` outstanding | `pendingPlan` is rehydrated. Responding via `respondToPlanApproval(...)` resumes and (if approved) flips the session's mode. |
| Mid-flush (storage transaction) | The transaction either committed or it didn't. At-least-once for queue items applies as above. |

**Durability boundary.** The harness owns durability for `queue` items pre-acceptance. The agent layer owns durability for everything signal-driven post-acceptance (every `message(...)` and every drained `queue(...)`). The boundary is the `signal.accepted` resolution from `agent.sendSignal(...)`.

**Queue replay.** Items in `pendingQueue` are durable. The head item is removed *after* its turn completes successfully. If a turn was mid-flight at crash time, the item re-runs (at-least-once). Per-turn overrides (`model`, `mode`, `yolo`) stored on the queued item replay with the same overrides. There is no `addTools` field to replay: `queue(...)` rejects `addTools` at admission so a queued item never represents a tool surface that storage cannot reproduce — see §4.3 and §5.1.

**`message` durability is intentional.** Persisting interactive `message` items would defeat the Slack semantic — multiple concurrent users sending messages should not produce a recoverable queue, just live inputs into the conversation. If a caller wants survival across restarts, they use `queue`.

**What this buys us.**

- A laptop tab and a phone tab pointing at the same session see consistent state because both go through `harness.session({ sessionId })` and both hit the same record.
- An OS-level kill of the server doesn't lose pending approvals, queued messages, or in-flight tool suspensions. The next process boot answers `harness.session(...)` calls from storage and the user picks up where they left off.
- Tools and clients don't have to model "is this a fresh session or a resumed one" — the contract is the same either way.

### 5.8 Write-concurrency contract

Every persisted `SessionRecord` has at most **one owner** at a time. The owner is the Harness instance that holds the live `Session` object. All durable writes to that record — queue append, pending approval / suspension / question / plan registration, mode / model switch, `setState`, lifecycle transitions, debounced flushes — go through the owner. Storage adapters never see concurrent writers for the same `sessionId` under normal operation.

This makes "the live `Session` instance is the runtime authority" (§5.4) an enforceable invariant rather than a convention.

**Lease lifecycle.**

- `harness.session(...)` acquires the lease as part of hydration. The harness instance has a stable `ownerId` (process-scoped UUID, generated at construction).
- The owner renews the lease on every flush. Synchronous (durable) flushes always renew; debounced flushes renew opportunistically. A separate keep-alive interval (default `sessions.lockRenewMs`, `10s`) renews the lease even if no flush has happened, so a long-idle but in-memory session keeps its claim.
- `session.close()` and `harness.shutdown()` release the lease cleanly. Idle eviction (§5.4) also releases — eviction is a release, not a steal.
- On owner crash, the lease expires after `sessions.lockTtlMs` (default `30s`) and the record becomes hydratable again.

**Acquisition under contention.** If `harness.session({ sessionId })` finds an unexpired lease held by a different `ownerId`, the behaviour is governed by `sessions.lockMode`:

| `lockMode` | Behaviour |
|---|---|
| `'fail'` (default) | Throw `HarnessSessionLockedError` immediately. Caller decides whether to retry, surface to the user, or route the request to the owning instance. Honest, fast, no hidden waiting. |
| `'wait'` | Block (with caller-controllable timeout via `sessions.lockWaitMs`, default `5s`) until the existing lease is released or expires, then acquire. Friendlier for browser reconnect flows where the previous tab's lease is about to TTL out. Recommended setting for Mastra Server SSE deployments. |
| `'steal'` | Force-acquire by bumping the record's `version` and invalidating the previous owner's writes. The previous owner's next flush fails with `HarnessStorageError` and that owner drops the in-memory `Session` after surfacing an `error` event. Reserved for operator tools and tests; **not recommended** as a default. |

**Conflict detection.** Every `saveSession(record, { ownerId, ifVersion })` is conditional on the stored `version` matching `ifVersion`. The storage adapter increments `version` on success and returns the new value. On mismatch, the call rejects with `HarnessStorageError`. The owner then re-hydrates the record, re-applies its in-memory delta, and retries once before surfacing the failure to the originating call. This handles the rare case where a `'steal'` happened or a clock-skewed adapter let two writers commit.

**`setState` atomicity** is a *within-process* guarantee: the owner serialises updaters through a single in-memory queue, so `setState(prev => next)` is always read-modify-write against the latest state. Cross-process atomicity is not promised, because cross-process writers are not promised — that's what the lease is for.

**Subagent sessions** share the parent's lease. A child session's record is owned by whichever instance owns the parent. A subagent run never spans Harness instances, so there's nothing to coordinate. The child's `version` still advances independently for conflict detection against operator tools that touch the record directly (e.g. an admin closing a subagent session).

**Storage interface.** §5.2 already lists the four primitives this contract requires: `acquireSessionLease`, `renewSessionLease`, `releaseSessionLease`, and the `{ ownerId, ifVersion }` form of `saveSession`. Adapters that don't have a native lease primitive can implement leases on top of the same `version` field — `acquire` becomes a conditional UPDATE that sets `ownerId` and `leaseExpiresAt` only if the existing values are absent or expired.

**Errors raised.**

- `HarnessSessionLockedError` — `harness.session(...)` could not acquire the lease under `lockMode: 'fail'`. Includes `currentOwnerId` and `expiresAt` for diagnostic logging and for clients that want to route the request to the holding instance.
- `HarnessStorageError` — durable write rejected by the adapter. After one transparent retry, surfaced to the caller.

**Configuration.** §9 defines the knobs:

```ts
sessions: {
  lockMode?: 'fail' | 'wait' | 'steal';   // default 'fail'
  lockTtlMs?: number;                     // default 30_000
  lockRenewMs?: number;                   // default 10_000
  lockWaitMs?: number;                    // default 5_000 (used only when lockMode = 'wait')
  // ...other session knobs
}
```

---

## 6. Tool authoring contract

Tools authored for the Harness are standard Mastra agent tools — same `description`, `inputSchema`, `outputSchema`, and `execute(input, context)` shape. The Harness extends them by populating a `'harness'` slot on the agent's `RequestContext`, reachable from `execute` via:

```ts
const harnessCtx = context.requestContext.get('harness') as HarnessRequestContext;
```

This section is the contract for that slot.

### 6.1 `HarnessRequestContext`

```ts
interface HarnessRequestContext<TState = unknown> {
  // Identity — always populated.
  harnessId: string;
  sessionId: string;
  threadId: string;
  resourceId: string;

  // Current per-turn defaults (resolved with overrides applied).
  modeId: string;

  // User-defined session state.
  state: TState;
  getState: () => TState;
  setState: SetStateFn<TState>;

  // Lifecycle.
  abortSignal: AbortSignal;

  // Eventing and suspension.
  emitEvent: (event: HarnessEvent) => void;
  registerQuestion: (params: RegisterQuestionParams) => void;
  registerPlanApproval: (params: RegisterPlanApprovalParams) => void;

  // Subagent linkage. For the parent session: `subagentDepth: 0`,
  // `source: 'parent'`, `parentSessionId` and `subagentToolCallId` undefined.
  // For a subagent: depth ≥ 1, `source: 'subagent'`, parent linkage populated.
  subagentDepth: number;
  source: 'parent' | 'subagent';
  parentSessionId?: string;
  subagentToolCallId?: string;

  // Subagent model resolver — returns the configured model ID for a given
  // agent type, or `null` to fall back to the session's default model.
  getSubagentModel: (params?: { agentType?: string }) => string | null;

  // Workspace handle — only present when the harness is configured with a
  // workspace. Tools that need filesystem / sandbox access should always
  // null-check this and degrade gracefully when it's missing.
  workspace?: Workspace;
}

// `setState` is overloaded:
//  - Object form does a shallow merge into the current state.
//  - Function form runs an atomic read-modify-write — the harness reads the
//    live state at call time, passes it to the updater, persists the return.
//    The updater MUST be synchronous; async work should happen first, then
//    the resolved value goes into a fresh setState call.
type SetStateFn<TState> = {
  (updates: Partial<TState>): Promise<void>;
  (updater: (prev: TState) => TState): Promise<void>;
};
```

### 6.2 Field semantics

**Identity.**
- `sessionId`, `threadId`, `resourceId` are stable for the lifetime of a tool invocation. They identify *this* call's session, not the harness's "active" session (there isn't one — see §2.1).
- `harnessId` is the harness instance ID. Useful for log correlation across processes.

**State.**
- `getState()` returns the live state object — it reflects writes from earlier in the same turn.
- `setState({ ... })` shallow-merges the patch and resolves once the change is persisted to storage (durable transition, see §5.7).
- `setState(prev => next)` is the atomic form. Use it for read-modify-write — counters, array pushes, anything where the next value depends on the current one. The updater runs synchronously; the resolved promise means the new value is persisted.
- Tools sharing `state` across parallel tool calls (under `experimental_parallelToolCalls`) should prefer the functional form. Within a single tool invocation reads and writes are coherent regardless.

**Abort.**
- `abortSignal` is the turn's signal. It fires when the agent layer cancels the run (`agent.abort(...)`, max-steps), when the parent subagent run aborts, when the session is being closed, or when the harness process is tearing down. Cancellation is not a session concern in v1 — the harness does not own a public `abort` surface (see §3).
- Long-running tool work should subscribe to `abortSignal` and cancel cleanly. The harness will wait for `execute` to settle, but a tool that ignores the signal will block the run from terminating for as long as it takes.
- `abortSignal.reason` is a `HarnessAbortedError` whose `reason` field is one of the four `HarnessAbortReason` values (§4.5). The distinction matters when tools maintain external state (sandbox processes, locks, partial writes):

  | `reason`           | What tools should typically do |
  | ------------------ | ------------------------------ |
  | `agent_aborted`    | Run normal rollback/cleanup. The user wants this work stopped. |
  | `parent_aborted`   | Skip side-effect rollback by default — the parent's own cleanup will dominate. (Subagents only.) |
  | `session_closed`   | Treat as terminal. No new turn will land here. Release any resources keyed by `sessionId`. |
  | `process_restart`  | Best-effort cleanup. The session record stays intact; queued items are *not* failed by this reason — they replay per §5.7 on the next hydration. |

  Tools that don't care about the source can ignore `reason` and treat the signal as a flat "stop now."

**Events.**
- `emitEvent(event)` forwards any event to subscribers of this session. Custom event types pass through unchanged — the harness does not inspect or schema-validate them.
- Tools **must not** synthesize harness-owned event types: `agent_start`, `agent_end`, `text_delta`, `tool_start`, `tool_end`, `subagent_*`, `state_changed`, `mode_changed`, `model_changed`, `session_*`, `goal_*`. The harness owns these and will overwrite or duplicate them. Use a custom type prefix (e.g. `myorg.tool.progress`) for tool-level signals.
- `registerQuestion` / `registerPlanApproval` are how `ask_user` and `submit_plan` (and any custom suspending tools you write) hand control back to the user. The harness pairs the registration with a Mastra workflow suspension — see §5.7 for the resume story.

**Subagent linkage.**
- `subagentDepth` is `0` for the parent session, `1` for a direct subagent, `2` for a subagent of a subagent, capped at `subagents.maxDepth` (see §8).
- `source` is `'parent'` or `'subagent'` — derivable from `subagentDepth > 0` but exposed as a first-class field because most tool gating reads as `if (source === 'subagent') { ... }`.
- `parentSessionId` is the subagent's parent — same value the SessionRecord stores. Walking the chain rebuilds the subagent tree.
- `subagentToolCallId` is the parent's tool-call ID that spawned this subagent. Useful for attributing events back to a parent UI element.

**Workspace.**
- When configured (`HarnessConfig.workspace`), the resolved `Workspace` is plumbed through. Subagents inherit the parent's workspace by default; the subagent tool config can opt into a fresh workspace under `kind: 'per-session'` (see §2.7, §8).
- Tools that don't need filesystem or sandbox access should not look at this field. Tools that do should null-check and either fail informatively or degrade.

### 6.3 What tools must not do

The harness slot is intentionally narrow. The following are out-of-contract:

- **Reach into other sessions.** A tool only acts on the session that invoked it. Cross-session orchestration (e.g. fanning out to N sessions for batch work) is the harness consumer's job, not the tool's. There's no `harness` reference on `HarnessRequestContext` for that reason.
- **Touch `MastraStorage` directly.** Storage is the harness's contract with persistence — tools mutate session state through `setState`, write files through `workspace.filesystem`, and emit events through `emitEvent`. Raw storage access bypasses the durable-transition guarantees in §5.7.
- **Mutate permissions.** Tools cannot grant themselves categories, change permission rules, or bypass the approval flow. Permission decisions are user-driven and live on the session.
- **Switch mode or model.** A tool's job is to do work, not to change the session's defaults. If a workflow legitimately needs to change mode (e.g. plan mode → build mode after `submit_plan` approval), that flip happens in the harness's plan-approval handler, not inside `execute`.
- **Synthesize harness-owned event types.** See above.

### 6.4 Built-in tool behaviour vs `source`

The built-in tools (`task_write`, `submit_plan`, `ask_user`) read `source` to keep parent and subagent state isolated:

- **`task_write`** — writes to the calling session's task list. A subagent's task list is separate from the parent's; calling `task_write` from a subagent never overwrites the parent's tasks. (The mechanism: tasks live in `session.state`, and there are two sessions involved.)
- **`submit_plan`** — registers a plan approval against the calling session. When approved by the user, the harness flips the calling session's mode (typically plan → build). A subagent's `submit_plan` flips the subagent's mode, never the parent's. The user-facing event is tagged with `source` so the UI can attribute it ("subagent X submitted a plan").
- **`ask_user`** — registers a pending question against the calling session. The user sees the question with subagent attribution if `source === 'subagent'`.

Custom tool authors implementing similar suspension patterns should follow the same rule: act on the calling session only, and tag user-facing events with `source` for attribution.

### 6.5 Example

```ts
import { createTool } from '@mastra/core/tools';
import type { HarnessRequestContext } from '@mastra/core/harness/v1';
import { z } from 'zod';

export const incrementCounter = createTool({
  id: 'increment_counter',
  description: 'Bump a named counter on the session.',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ value: z.number() }),

  execute: async ({ context: input, requestContext }) => {
    const harness = requestContext.get('harness') as HarnessRequestContext<{
      counters: Record<string, number>;
    }>;

    let next = 0;
    await harness.setState(prev => {
      const current = prev.counters?.[input.name] ?? 0;
      next = current + 1;
      return { ...prev, counters: { ...prev.counters, [input.name]: next } };
    });

    harness.emitEvent({
      type: 'myorg.counter.bumped',
      sessionId: harness.sessionId,
      name: input.name,
      value: next,
    });

    return { value: next };
  },
});
```

The functional `setState` form is the right tool here: two parallel `increment_counter` calls under `experimental_parallelToolCalls` would race with the object form, but the functional form linearises through the harness.

---

## 7. Sandbox command registry

`WorkspaceSandbox` gains optional methods for declaring known commands:

```ts
interface WorkspaceSandbox {
  // ...existing fields...
  defineCommand?(name: string, definition?: CommandDefinition): void;
  getCommands?(): Record<string, CommandDefinition>;
}

interface SandboxConfig {
  commandPolicy?: 'open' | 'restricted'; // default 'open'
  commands?: Record<string, CommandDefinition | null>;
}

interface CommandDefinition {
  execute?: (args: string[], options: ExecuteCommandOptions) => Promise<CommandResult>;
  env?: Record<string, string>;
  description?: string;
}
```

Resolution rules:
- Structured form (`execute('gh', ['pr', 'list'])`) consults the registry.
- String form (`execute('gh pr list')`) skips the registry — no parsing.
- Registered `env` overrides caller `env` for the same keys (security boundary).
- `'restricted'` policy: unregistered commands return `{ exitCode: 127 }`.
- `'open'` policy (default): unregistered commands run normally.

---

## 8. Subagent guarantees

- **Depth cap.** `HarnessConfig.subagents.maxDepth` (default `1`, see §9). Tracked in `HarnessRequestContext.subagentDepth`. Overflow returns a tool-result error (recoverable, not thrown).
- **Parent linkage.** All `subagent_*` events carry `parentId?: string` (the parent's tool-call ID) and `depth: number`. Root subagents have `parentId = undefined`, `depth = 1`.
- **State isolation.** Subagent sessions have their own `permissions`, `task_write` list, `submit_plan` state, and approval queue. Parent state is untouched.
- **Workspace inheritance.** Subagents inherit the parent session's workspace by default — they typically cooperate on the same code/files as the parent. Subagent tool config can opt into a fresh workspace via `{ workspace: 'fresh' }` (only valid when the harness is configured with `kind: 'per-session'`). Fresh subagent workspaces are torn down on subagent session close. See §2.7.

---

## 9. Configuration

```ts
interface HarnessConfig<TState = Record<string, unknown>> {
  // Required
  agents: Record<string, Agent>;                      // Mastra agents keyed by ID
  modes: HarnessMode[];                               // Available modes
  resolveModel: (modelId: string) => LanguageModel;   // Model resolver
  storage: HarnessStorage;                            // Thread + message persistence

  // Sessions
  defaultResourceId?: string;                         // Default tenant
  defaultModelId?: string;                            // Fallback when session has none selected
  sessions?: {
    maxLive?: number;                                 // Cap on hydrated sessions. Default: Infinity (no cap).
    idleTimeoutMs?: number;                           // Auto-evict after this idle period. Default: 2 * 60 * 60 * 1000 (2 hours).
                                                      //   Sessions with a pending approval/suspension/question/plan
                                                      //   are exempt from this check — see §5.4.
    flushDebounceMs?: number;                         // Debounce window for writing dirty state. Default: 500
    maxFlushFailures?: number;                        // Consecutive debounced-flush failures tolerated
                                                      //   before the session goes into storage-error mode.
                                                      //   Default: 5. See §5.7.
    eventBufferSize?: number;                         // Per-session ring buffer size for event replay
                                                      //   on SSE reconnect (`Last-Event-ID`).
                                                      //   Default: 1000. See §13.3.

    maxQueueDepth?: number;                           // Cap on `SessionRecord.pendingQueue` length.
                                                      //   When at the cap, `session.queue(...)` rejects
                                                      //   with `HarnessQueueFullError` *before* mutating
                                                      //   storage. The capacity check + durable append
                                                      //   are atomic under the session's write lease
                                                      //   (§5.8). Default: Infinity (unbounded).
                                                      //   Cap deliberately does *not* trigger
                                                      //   `HarnessBusyError` — busy state is what queue
                                                      //   exists for. See §3 and §5.7.

    // Write-concurrency — see §5.8.
    lockMode?: 'fail' | 'wait' | 'steal';             // Behaviour when another instance owns the lease.
                                                      //   Default: 'fail'. 'wait' is recommended for
                                                      //   browser/SSE deployments. 'steal' is for
                                                      //   operator tools and tests.
    lockTtlMs?: number;                               // Lease TTL. The owner renews on every flush
                                                      //   and on a `lockRenewMs` interval. After TTL
                                                      //   without renewal the lease is reclaimable.
                                                      //   Default: 30_000.
    lockRenewMs?: number;                             // Keep-alive interval for lease renewal even
                                                      //   when no flush has happened. Default: 10_000.
    lockWaitMs?: number;                              // Maximum time `harness.session(...)` blocks
                                                      //   when `lockMode = 'wait'` before throwing
                                                      //   `HarnessSessionLockedError`. Default: 5_000.
  };

  // Skills
  skills?: HarnessSkill[];                            // Code-registered skills (precedence over filesystem)

  // Subagents
  subagents?: {
    maxDepth?: number;                                // Default: 1
  };

  // File attachments
  files?: {
    maxInlineBytes?: number;                          // Inline attachments larger than this are rejected.
                                                      //   Default: 10 * 1024 * 1024 (10 MiB).
                                                      //   Larger files must use the `kind: 'url'` form
                                                      //   or be pre-uploaded via the wire protocol's
                                                      //   file route (see §13).
  };

  // Goals — see §4.7
  goals?: {
    defaultJudgeModel?: string;                       // Used when `setGoal({ judgeModel })` omits the field.
                                                      //   No default — `setGoal` throws if the goal has no
                                                      //   judge model and no default is configured.
    defaultMaxTurns?: number;                         // Default: 50
  };

  // Workspace — see §2.7 for ownership models and the provider contract.
  // Sugar: passing a `Workspace` is equivalent to `{ kind: 'shared', instance }`.
  // Sugar: passing a function is equivalent to `{ kind: 'per-session', provider:
  //   nonDurableProvider(fn) }` (resumable: false; sessions cannot survive
  //   restarts).
  workspace?: WorkspaceConfig | Workspace | WorkspaceFactoryFn;

  // Observational Memory
  observationalMemory?: ObservationalMemoryConfig;

  // Tooling
  tools?: ToolsetInput;                               // Available tools
  toolCategories?: Record<string, ToolCategory>;      // Category mapping
  defaultPermissionPolicy?: PermissionPolicy;         // Default approval behaviour

  // Lifecycle hooks
  intervals?: IntervalHandler[];                      // Registered at init via `onInterval`

  // State
  initialState?: TState;
}

interface IntervalHandler {
  id: string;
  ms: number;                                         // Tick interval
  handler: () => void | Promise<void>;
  immediate?: boolean;                                // Fire once on registration. Default: false
  shutdown?: () => void | Promise<void>;              // Called when the interval is removed
}

// Workspace configuration. Three discriminated shapes. `per-session` uses
// the `WorkspaceProvider` contract (see §2.7) so the harness can validate
// resumability at startup without provisioning a real sandbox. `shared` and
// `per-resource` workspaces aren't tied to a specific session record and
// don't carry a `providerId`.
type WorkspaceConfig =
  | { kind: 'shared'; instance: Workspace }
  | {
      kind: 'per-resource';
      create: (ctx: { resourceId: string }) => Workspace | Promise<Workspace>;
      eager?: boolean;                                // Provision on first session(); default false
    }
  | {
      kind: 'per-session';
      provider: WorkspaceProvider;                    // see below
      eager?: boolean;                                // Provision on harness.session(); default false
    };

// The contract a per-session workspace provider must satisfy. The harness
// reads `providerId` and `resumable` at config time — without calling
// `create` — so that a misconfigured combination (e.g. `per-session` against
// a non-resumable provider that the operator expected to survive restarts)
// is rejected at `harness.init()` rather than discovered after a crash.
interface WorkspaceProvider {
  // Stable, human-readable identity. Persisted into
  // `SessionRecord.workspace.providerId` and matched on rehydration. A
  // mismatch surfaces `HarnessWorkspaceProviderMismatchError` rather than
  // silently handing the record to the wrong provider.
  readonly providerId: string;

  // Static capability declaration. `false` providers are accepted only as
  // sugar (factory shorthand) and the harness will not persist or attempt
  // to resume their workspaces — see the factory-shorthand note below.
  readonly resumable: boolean;

  // Called the first time a session needs a workspace, or eagerly at
  // session creation if `eager: true`. The returned Workspace must offer
  // an opaque `getState()` to feed the harness's persistence loop when
  // `resumable: true`.
  create(ctx: WorkspaceCreateContext): Workspace | Promise<Workspace>;

  // Required when `resumable: true`. Called after a server restart with
  // whatever blob the harness stored in `SessionRecord.workspace.state`
  // before the restart. Must return a live Workspace equivalent to the
  // pre-restart instance from the agent's perspective.
  resume?(ctx: WorkspaceResumeContext): Workspace | Promise<Workspace>;
}

interface WorkspaceCreateContext {
  sessionId: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
}

interface WorkspaceResumeContext extends WorkspaceCreateContext {
  // The opaque blob the provider previously reported via
  // `SessionRecord.workspace.state`. Type-erased on purpose — providers
  // own its shape.
  state: unknown;
}

// Factory-shorthand sugar. Equivalent to:
//   { kind: 'per-session', provider: nonDurableProvider(fn) }
// where `nonDurableProvider(fn)` returns a `WorkspaceProvider` with
// `resumable: false`, an auto-generated `providerId` (e.g. an opaque
// hash of the function reference), and no `resume` implementation.
// Sessions provisioned through this path are NOT durable across server
// restarts — see §2.7.
type WorkspaceFactoryFn = (ctx: WorkspaceCreateContext) => Workspace | Promise<Workspace>;
```

---

## 10. Events

Events are how the harness reports what's happening to subscribers. They fan out two ways:

- **Session-scoped** — emitted on a specific session and delivered to every subscriber of that session (`session.subscribe(...)`). All turn-level activity flows here.
- **Harness-scoped** — emitted at the harness level for things that don't belong to any one session (session lifecycle, intervals, storage errors). Delivered to harness subscribers (`harness.subscribe(...)`).

Both surfaces use the same listener shape: `(event: HarnessEvent) => void`, returning an unsubscribe function.

### 10.1 Event shape

Every event has the same four base fields plus a discriminated payload keyed by `type`:

```ts
interface HarnessEventBase {
  id: string;                        // Epoch-prefixed, per-session monotonic event ID, of the form
                                     // `<epoch>-<seq>`. `epoch` is regenerated on every cold start
                                     // of the in-memory Session instance (initial hydration, or
                                     // re-hydration after eviction), and `seq` is a monotonic int
                                     // within that epoch. Harness-scoped events use a parallel
                                     // harness-scoped epoch+seq. See §10.5 for the replay contract
                                     // and how stale IDs from a previous epoch are detected.
  type: string;                      // Discriminator. Built-in types listed below;
                                     // custom types use a dotted prefix (e.g. `myorg.foo`).
  sessionId?: string;                // Set for session-scoped events; absent for harness-scoped.
  timestamp: number;                 // ms epoch.
}

type HarnessEvent = HarnessEventBase & (
  | LifecycleEvent
  | StateEvent
  | TurnEvent
  | ToolEvent
  | SubagentEvent
  | SuspensionEvent
  | AttachmentEvent
  | StorageErrorEvent
  | CustomEvent
);
```

### 10.2 Built-in event union

```ts
// Lifecycle (harness-scoped unless noted)
type LifecycleEvent =
  | { type: 'session_created'; sessionId: string; resourceId: string; threadId: string; parentSessionId?: string }
  | { type: 'session_closed';  sessionId: string; reason: 'requested' | 'evicted' | 'shutdown' }
  | { type: 'session_evicted'; sessionId: string }                  // dropped from live cache; record stays
  | { type: 'session_hydrated'; sessionId: string };                // re-loaded from storage on next access

// State (session-scoped)
type StateEvent =
  | { type: 'state_changed'; path: string; value: unknown }         // `setState` write committed
  | { type: 'mode_changed';  modeId: string }
  | { type: 'model_changed'; modelId: string }
  | { type: 'token_usage_changed'; usage: TokenUsage };

// Turn (session-scoped)
type TurnEvent =
  | { type: 'agent_start';   runId: string; overrides?: HarnessOverrides }
  | { type: 'text_delta';    runId: string; delta: string }
  | { type: 'agent_end';     runId: string; finishReason: string; usage: TokenUsage }
  | { type: 'error';         runId?: string; error: { code: string; message: string } };

// Tool calls (session-scoped)
type ToolEvent =
  | { type: 'tool_start';    runId: string; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool_end';      runId: string; toolCallId: string; toolName: string; output: unknown; isError: boolean };

// Subagent activity (session-scoped — emitted on the *parent* session's subscriber).
// `subagentSessionId` is the child session's ID and is stable across the subagent's
// lifetime. Combined with `toolCallId` (the parent-side handle), this lets a UI wire
// up the parent → child mapping at `subagent_start` and address the child session
// directly for response routing (see §10.6 and §13.2).
type SubagentEvent =
  | { type: 'subagent_start';      toolCallId: string; subagentSessionId: string; agentType: string; task: string; modelId: string; parentId?: string; depth: number }
  | { type: 'subagent_text_delta'; toolCallId: string; subagentSessionId: string; agentType: string; delta: string; parentId?: string; depth: number }
  | { type: 'subagent_tool_start'; toolCallId: string; subagentSessionId: string; agentType: string; innerToolCallId: string; toolName: string; parentId?: string; depth: number }
  | { type: 'subagent_tool_end';   toolCallId: string; subagentSessionId: string; agentType: string; innerToolCallId: string; toolName: string; output: unknown; isError: boolean; parentId?: string; depth: number }
  | { type: 'subagent_end';        toolCallId: string; subagentSessionId: string; agentType: string; output: unknown; isError: boolean; durationMs: number; parentId?: string; depth: number };

// Suspension — tool / question / plan needs user input (session-scoped).
//
// When `source: 'subagent'`, the pending item lives on the *subagent's* session
// (subagents are independent persisted sessions — see §5.6). Two extra fields are
// then required: `subagentToolCallId` (the parent-side tool-call that spawned the
// subagent) and `subagentSessionId` (the child session ID). Clients MUST post the
// response to the child session's inbox:
//   POST /sessions/<subagentSessionId>/inbox/<toolCallId>
// Posting to the parent session's inbox returns 404 — see §13.2.
//
// When `source: 'parent'`, both subagent fields are absent.
type SuspensionEvent =
  | ({ type: 'tool_approval_required';  runId: string; toolCallId: string; toolName: string; toolCategory?: string; input: unknown }
      & ({ source: 'parent' } | { source: 'subagent'; subagentToolCallId: string; subagentSessionId: string }))
  | ({ type: 'tool_suspension_required'; runId: string; toolCallId: string; toolName: string; suspendData: unknown }
      & ({ source: 'parent' } | { source: 'subagent'; subagentToolCallId: string; subagentSessionId: string }))
  | ({ type: 'question_pending';        runId: string; toolCallId: string; question: string; options?: string[]; selectionMode?: 'single' | 'multi' }
      & ({ source: 'parent' } | { source: 'subagent'; subagentToolCallId: string; subagentSessionId: string }))
  | ({ type: 'plan_approval_required';  runId: string; toolCallId: string; title: string; plan: string }
      & ({ source: 'parent' } | { source: 'subagent'; subagentToolCallId: string; subagentSessionId: string }));

// Attachments (session-scoped)
type AttachmentEvent =
  | { type: 'attachment_uploaded'; attachmentId: string; name: string; mimeType: string; bytes: number }
  | { type: 'attachment_deleted';  attachmentId: string };

// Goals (session-scoped). See §4.7.
type GoalEvent =
  | { type: 'goal_set';      goal: GoalState }
  | { type: 'goal_judged';   goalId: string; decision: GoalJudgeDecision; turnsUsed: number; maxTurns: number }
  | { type: 'goal_done';     goalId: string; reason: string; turnsUsed: number }
  | { type: 'goal_paused';   goalId: string; reason: 'requested' | 'budget_exhausted' | 'judge_failed' }
  | { type: 'goal_resumed';  goalId: string }
  | { type: 'goal_cleared';  goalId: string };

// Storage / flush failures (session-scoped or harness-scoped depending on origin)
type StorageErrorEvent =
  | { type: 'storage_error'; phase: 'flush' | 'hydrate' | 'attachment'; error: { code: string; message: string }; sessionId?: string };

// Catch-all for tool-emitted custom events
type CustomEvent = { type: `${string}.${string}`; [key: string]: unknown };
```

The set is closed for built-in types (anything in the union above is harness-owned). Tools emit custom types only — see §10.3.

### 10.3 Custom events

Tools call `requestContext.get('harness').emitEvent(event)` to surface tool-level signals (progress, partial results, telemetry). Rules:

- **Type must use a dotted prefix.** `myorg.tool.progress`, `acme.scan.matched`, etc. The leading segment should identify the publisher; the trailing segments are the publisher's choice.
- **The harness does not validate the payload.** Anything beyond `type` is passed through to subscribers verbatim.
- **The harness fills in the base fields** (`id`, `sessionId`, `timestamp`). Tools must not set those themselves.
- **Built-in types are reserved.** Emitting any of `agent_*`, `text_delta`, `tool_*`, `subagent_*`, `state_changed`, `mode_changed`, `model_changed`, `session_*`, `token_usage_changed`, `tool_approval_required`, `tool_suspension_required`, `question_pending`, `plan_approval_required`, `attachment_*`, `storage_error`, `goal_*`, or `error` from a tool is a contract violation. The harness does not strip them — it just ends up duplicating the harness's own emission and corrupting subscriber state.

Custom events go through the same base-field, ordering, and replay rules as built-in events. Subscribers should narrow by `type` and tolerate unknown types (forward-compatibility).

### 10.4 Ordering guarantees

- **Per-session FIFO.** Within a single session, events are delivered to every subscriber in the order the harness emitted them. Subscribers added later still receive future events in order from the moment they subscribe; they do *not* automatically replay past events (use the SSE replay path in §10.5 for that).
- **Per-turn coherence.** For a given `runId`: `agent_start` is the first event, `agent_end` (or `error`) is the last. Between them, `text_delta`, `tool_start`/`tool_end`, and any `subagent_*` events for tools running in that turn appear in the order the agent layer produced them. Suspension events (`*_required`, `question_pending`) interleave with text/tool events at the point the suspension occurred and are followed by either a `tool_end` (after resume) or an `agent_end` (after abort).
- **Cross-session.** No ordering is guaranteed across different sessions. Two sessions running in parallel emit independently; subscribers that observe both should sort by `(sessionId, id)` if they need a stable rendering.
- **Listener delivery.** Listeners are invoked synchronously in registration order. Throwing from a listener does not stop other listeners and does not abort the turn — the exception is caught and logged. Listener errors are intentionally not re-emitted as events (that would invite feedback loops); subscribers that need visibility on their own failures should wrap their handler bodies.
- **At-least-once on replay.** During SSE reconnect (§10.5), events that were already delivered before disconnect may be re-delivered if the client's `Last-Event-ID` predates them. Subscribers that mutate external state on event receipt must be idempotent — keying side effects by `event.id` is the standard pattern.

### 10.5 Buffering and replay

Each session keeps a ring buffer of recent events (`sessions.eventBufferSize`, default 1000; see §9). The buffer feeds two consumers:

- **`session.subscribe(...)` after the fact.** If the session is currently in a turn when a new subscriber attaches, the subscriber sees future events only — no automatic backfill. Callers that need to recover from a missed window should use `session.listMessages(...)` for content and the SSE replay path for live event continuation.
- **SSE replay over the wire.** The Mastra Server adapter (§13) honours `Last-Event-ID` on the SSE endpoint. The server replays buffer entries newer than `Last-Event-ID`, then live-tails. See the replay rules below.

**Epoch and event IDs.** Each in-memory Session instance has an `epoch` token, generated fresh whenever the instance is constructed — first hydration, re-hydration after eviction, or hydration after a process restart. Event `id` is `<epoch>-<seq>`, where `seq` is monotonic within the epoch and resets when the epoch changes. Two events from different epochs are never comparable as a sequence, even if they share the same `seq`. Harness-scoped events use the same `<epoch>-<seq>` shape against the harness's own epoch+sequence.

**Replay rules.** On reconnect with `Last-Event-ID: <epoch>-<seq>`:

- If the epoch matches the current Session instance and `seq` is within the buffer, the server replays entries newer than the supplied ID and live-tails.
- If the epoch matches but `seq` is older than the buffer's oldest entry, the buffer has overflowed; the server returns `412 Precondition Failed`.
- If the epoch does not match the current Session instance, the prior epoch's buffer is gone (eviction or process restart). The server returns `412 Precondition Failed`.
- If `Last-Event-ID` is malformed (not `<epoch>-<seq>`) or absent, the server starts the SSE stream from the live tail with no replay.

In every `412` case the client is expected to refetch state via `GET /sessions/:sessionId` and resubscribe.

**Scope.** The buffer is in-memory only. On session eviction or harness shutdown the buffer is dropped along with its epoch — **durable replay across restarts is not a goal of v1**. The epoch contract makes the "stale ID after restart or eviction" path deterministic: any `Last-Event-ID` from a previous epoch is detected at the server and yields `412`, even if a new event happens to share the same `seq`. Synthesizing replay from message storage or any other persisted state is explicitly out of scope; SSE replay is best-effort over the live in-memory ring buffer only. Clients that need durable history beyond a single epoch should use `GET /sessions/:sessionId/messages` (§13.3) for the persisted message log and treat the SSE stream as live-only.

### 10.6 Subagent attribution

Subagent events are emitted on the **parent** session's subscriber, not the subagent's. This keeps a single live event stream as the source of truth for everything the user sees during a turn. Each `subagent_*` event carries:

- `toolCallId` — the parent's tool-call ID that spawned the subagent. Stable for the subagent's lifetime; pair `subagent_start`/`subagent_end` on this.
- `subagentSessionId` — the **child session's ID**. The subagent runs on its own persisted `SessionRecord` (§5.6); this field exposes that ID on every subagent event so a UI can address the child session directly without a round-trip to look it up. Stable for the subagent's lifetime.
- `parentId` — the parent's tool-call ID *one level up* in the chain. `undefined` for a top-level subagent (parent is the user turn, not another subagent). Used to reconstruct the tree when subagents nest.
- `depth` — `1` for a top-level subagent, `2` for a subagent of a subagent, capped at `subagents.maxDepth` (§8).

**Suspension events from inside a subagent.** Generic events emitted from a subagent's RequestContext (custom events, `tool_approval_required`, `tool_suspension_required`, `question_pending`, `plan_approval_required`) are not translated to `subagent_*` types — that would lose the underlying type information. They surface on the **parent** session's subscriber with:

- `source: 'subagent'`
- `subagentToolCallId: <parent-side tool-call>` — the same handle as `toolCallId` on the corresponding `subagent_start`. Used by the UI to associate the prompt with the right subagent card.
- `subagentSessionId: <child session ID>` — the session that actually owns the pending item. **The client MUST post the response to this session's inbox**, not the parent's. The pending approval / suspension / question / plan record lives on the child session's `SessionRecord`; the parent session has no record of it and does not know how to resume it.

The wire-protocol contract (§13.2) is therefore: for any subagent-attributed pending item, `POST /sessions/<subagentSessionId>/inbox/<toolCallId>`. Posting to `/sessions/<parentSessionId>/inbox/<toolCallId>` returns `404 inbox.item_not_found` — there is no parent-side proxy or dual-write. This keeps the `inbox` resource flat (one-session-one-inbox) and makes durability simple (response writes affect exactly one record).

**Direct subscription to a subagent's stream is supported.** Subagents are normal sessions, so `/sessions/<subagentSessionId>/events` is a valid SSE endpoint. A UI that wants raw subagent-internal events (text deltas, tool calls, custom events that aren't surfaced on the parent) can subscribe directly. Most UIs will not need to — the adapted `subagent_*` events on the parent stream cover the common case — but the option exists for richer renderings.

**Lifecycle coupling.** If the parent session is closed while a subagent has a pending item, `harness.closeSession({ sessionId: parentSessionId })` cascades close to all live descendants (subagents are bound to the parent's lease — §5.8). The pending item disappears with the child session. A client that races to respond after the cascade gets `404 session.closed`. Clients should treat any `subagentSessionId` as valid only between the corresponding `subagent_start` and `subagent_end` on the parent stream.

---

## 11. Migration from current Harness

The current `Harness` implementation has external consumers we don't directly control. Renaming it would surface as a "the import I had no longer exists" failure on a `@mastra/core` upgrade — exactly the kind of surprise the migration story should avoid until a real major version (`@mastra/core` v2) is on the table.

So v1 ships **two implementations side-by-side, both exported as `Harness`**, from different subpaths:

- **`@mastra/core/harness`** — the existing implementation, **unchanged**. Same class, same methods, same name. Existing callers keep working with no edit at all.
- **`@mastra/core/harness/v1`** — the new, session-oriented API described in this spec. Also exported as `Harness`. New callers explicitly opt in to the new behaviour by changing the subpath.

```ts
// Existing code — unchanged. Still works after `@mastra/core` upgrades.
import { Harness } from '@mastra/core/harness';

// New code — opt in to the v1 API by changing the subpath.
import { Harness } from '@mastra/core/harness/v1';
```

Two consequences of this layout:

- **No surprise breakage.** A team that depends on `@mastra/core` and never touches `Harness` directly cannot end up with the new shape unintentionally. The v1 API is reachable only through the explicit `v1` subpath.
- **Both are fully functional.** Each subpath ships its own implementation with no shared runtime; either can be used in production. There is no `@deprecated` marker on the legacy export — it stays a first-class entry point until `@mastra/core` v2.

The two `Harness` classes are not assignment-compatible. Mixing them in the same file is allowed (TypeScript will see two distinct types) but rare; aliasing is the usual pattern when both must coexist:

```ts
import { Harness as LegacyHarness } from '@mastra/core/harness';
import { Harness as HarnessV1 }     from '@mastra/core/harness/v1';
```

### 11.1 Code layout

```
packages/core/src/harness/
├── index.ts                 # subpath: '@mastra/core/harness'
│                            # exports `Harness` = the existing implementation
├── harness.ts               # the existing implementation, unchanged
├── tools.ts                 # ... existing files, unchanged
├── display-state-scheduler.ts
├── ...
└── v1/
    ├── index.ts             # subpath: '@mastra/core/harness/v1'
    │                        # exports `Harness` = the new implementation
    ├── harness.ts           # new `Harness` class (the registry/factory side)
    ├── session.ts           # `Session` class
    ├── shared.ts            # re-exports stable types from ../ when shape matches
    └── ...
```

Stable interfaces (`HarnessMessage`, `HarnessMode`, `HarnessStorage`, workspace types) are re-exported from both subpaths and back the same underlying definitions wherever shapes align. When the v1 API needs a shape change (for example, `HarnessRequestContext` gaining required fields per §6.1), the new shape lives in `v1/` and the old shape stays under the legacy subpath untouched. There is no shared base class and no runtime shim.

### 11.2 Storage compatibility

Threads written by the legacy `Harness` are readable by the v1 `Harness`. The thread-record schema is the persistence contract; it is not coupled to either runtime class. Runtime-state fields that legacy stored in thread metadata (`currentModeId`, `currentModelId`) are still read by the v1 `Harness` as bootstrap defaults when opening a session for an existing thread, but are no longer written back from runtime state — they are managed on `Session` going forward and persisted via `session.switchMode` / `session.switchModel` (which still update the metadata for legacy readers on the next read).

### 11.3 Deprecation timeline

- **`@mastra/core` v1.x** — both subpaths ship and are fully supported. The legacy export is *not* marked `@deprecated`; we don't want to nag external users mid-major.
- **`@mastra/core` v2.0** — the legacy implementation is removed. The `@mastra/core/harness` subpath becomes the v1 implementation (the `/v1` subpath is kept as an alias for one minor version, then dropped).

In short: nothing breaks during `@mastra/core` v1, ever. The rename only happens at v2, which is when consumers expect breaking changes anyway.

### 11.4 Method translation table

The table below maps each method on the legacy `Harness` to its new `Harness` + `Session` equivalent (i.e. the `@mastra/core/harness/v1` API).

| Legacy `Harness` (`@mastra/core/harness`) | v1 `Harness` + `Session` (`@mastra/core/harness/v1`) |
|---|---|
| `harness.sendMessage(...)` | `session.message(...)` (default — always accepted, signal-driven). Use `session.queue(...)` only for sequential standalone turns. |
| `harness.getCurrentThreadId()` | `session.threadId` |
| `harness.switchThread({ threadId })` | `harness.session({ threadId, resourceId })` |
| `harness.switchMode({ modeId })` | `session.switchMode({ mode })` |
| `harness.switchModel({ modelId })` | `session.switchModel({ model })` |
| `harness.subscribe(listener)` | `session.subscribe(listener)` (or `harness.subscribe` for cross-session) |
| `harness.getDisplayState()` | `session.getDisplayState()` |
| `harness.abort()` | *removed* — cancellation is not a session concern in v1. With agent signals, messaging and stopping are orthogonal. Clients that want a "STOP" affordance call `agent.abort(...)` (or whatever surface owns the run loop) and then `session.message(...)` for new content. |
| `harness.steer(...)` | *removed* — `session.message(...)` already drains into the live run via signals. The "abort + redirect" semantic is no longer needed; if a caller really wants to abort first, that's a separate agent-layer concern (see `harness.abort()` row). |
| `harness.followUp(...)` | `session.message(...)` (default) or `session.queue(...)` (sequential turns). |
| `harness.isRunning()` | `session.isBusy()` |
| `harness.memory.createThread(...)` | `harness.threads.create(...)` |
| `harness.cloneThread(...)` | `harness.threads.clone(...)` |
| `harness.listThreads(...)` | `harness.threads.list(...)` |
| `harness.renameThread({ title })` | `harness.threads.rename(threadId, title)` |
| `harness.grantSessionTool(...)` | `session.permissions.grantTool(...)` |
| `harness.setPermissionForCategory(...)` | `session.permissions.setPolicy({ category, policy })` |
| `harness.setPermissionForTool(...)` | `session.permissions.setPolicy({ toolName, policy })` |
| `harness.getObservationalMemoryRecord()` | `session.om.getRecord()` |
| `harness.switchObserverModel(...)` | `session.om.switchObserverModel(...)` |
| `harness.registerHeartbeat(...)` | `harness.onInterval(...)` (returns unsubscribe) |
| `harness.removeHeartbeat({ id })` | call the unsubscribe function returned by `onInterval` |
| `harness.getModelName()` | *removed* — `session.getCurrentModelId().split('/').pop()` |
| `harness.getFullModelId()` | *removed* — duplicate of `getCurrentModelId()` |
| `harness.getResolvedObserverModel()` | *removed* — trivial composition |
| `harness.getSession()` | *removed* — name collides with new `Session` |
| `harness.selectOrCreateThread()` | *removed* — use `harness.session({ resourceId })` |
| `harness.setResourceId(...)` | *removed* — set at session creation |

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

## 12. Usage examples

The remaining sections are concrete walkthroughs of the v1 API. They are grouped by application shape (single-user TUI, multi-tenant server, headless script, subagent author).

### 12.1 Single-user TUI

The classic Mastra Code shape. One human, one process, one conversation at a time, but the user can switch between threads.

```ts
import { Harness } from '@mastra/core/harness/v1';
import { config } from './harness-config';

const harness = new Harness(config);
await harness.init();

// Bootstrap: resolve a session for this resource.
// Picks up the most-recent thread+session, or creates fresh ones if none exist.
const session = await harness.session({ resourceId: 'local-user' });

// Subscribe to events for live rendering.
const unsubscribe = session.subscribe((event) => {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    case 'tool_start':
      console.log(`\n[tool] ${event.toolName} started`);
      break;
    case 'agent_end':
      console.log('\n[idle]');
      break;
  }
});

// User types something. `message` is always accepted — drains into the live
// run via signals if the agent is busy, or starts a new run if idle.
session.message({ content: 'Refactor the auth middleware' });

// User types again while the agent is still working. With agent signals this
// just drops into the same run as new user input — the model sees both
// messages mid-reasoning.
session.message({ content: 'Also add rate limiting' });

// Use `queue` instead when you specifically want sequential, isolated turns
// (one turn finishes fully before the next prompt starts).
session.queue({ content: 'Now run the test suite' });

// User switches to a different thread. The current session stays resumable in storage —
// we don't close it, we just stop using it. (Eviction will drop it from memory if idle.)
const otherSession = await harness.session({ sessionId: otherSessionId });

// Shutdown.
await harness.shutdown();
```

### 12.2 Multi-tenant server

A web service hosting the same Harness instance for many users. Each request maps to a session.

```ts
import {
  Harness,
  HarnessBusyError,
  HarnessSessionNotFoundError,
  type Session,
} from '@mastra/core/harness/v1';

const harness = new Harness(config);
await harness.init();

// HTTP handler: send a message on behalf of the user.
app.post('/threads/:threadId/messages', async (req, res) => {
  const { user } = req.auth;
  const { threadId } = req.params;

  // Find or create the session for this thread. Different users can have
  // sessions against different threads concurrently. `session()` hits the live
  // map, falls through to storage, then creates if neither exists.
  const session = await harness.session({
    sessionId: sessionIdFor(user.id, threadId),
    threadId,
    resourceId: user.id,
  });

  // `message` is always accepted. With agent signals, concurrent posts on the
  // same thread (e.g. the same user from two tabs, or multiple users in a
  // shared session) all deliver — they drain into the live run as new user
  // input. Clients observe progress via the SSE event stream below.
  void session.message({ content: req.body.content });
  res.json({ ok: true });
});

// SSE handler: stream session events to the client.
app.get('/threads/:threadId/events', async (req, res) => {
  const { user } = req.auth;
  let session: Session;
  try {
    session = await harness.session({ sessionId: sessionIdFor(user.id, req.params.threadId) });
  } catch (err) {
    if (err instanceof HarnessSessionNotFoundError) return res.status(404).end();
    throw err;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  const unsubscribe = session.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', unsubscribe);
});

// Memory eviction is automatic (configured via `sessions.maxLive` /
// `sessions.idleTimeoutMs` in §9) — idle sessions get flushed to storage and
// dropped from the live map, but stay resumable.
//
// If you also want to *terminate* sessions that have been idle for a long time
// (e.g., abandoned tabs older than 30 days), run a sweeper against storage:
harness.onInterval({
  id: 'idle-session-terminator',
  ms: 24 * 60 * 60_000,
  handler: async () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60_000;
    for (const user of await getActiveUsers()) {
      const summaries = await harness.listSessions({ resourceId: user.id });
      for (const summary of summaries) {
        if (!summary.closedAt && summary.lastActivityAt < cutoff) {
          await harness.closeSession({ sessionId: summary.id });
        }
      }
    }
  },
});
```

### 12.3 Headless script — typed structured output

A backend job calls the Harness directly without a UI. Uses `message` with a Zod schema for typed output.

```ts
import { z } from 'zod';
import { Harness } from '@mastra/core/harness/v1';

const harness = new Harness(config);
await harness.init();

const session = await harness.session({
  resourceId: 'cron:nightly-summarizer',
  threadId: { fresh: true },
});

const SummarySchema = z.object({
  title: z.string(),
  bullets: z.array(z.string()).max(5),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
});

// `output` requires `sync: true` — skips the signal pathway and calls
// agent.generate() on a fresh runId. This is the only message form that can
// throw HarnessBusyError; for a fresh session we know it won't.
const summary = await session.message({
  content: `Summarize this support ticket:\n\n${ticket.body}`,
  output: SummarySchema,
  sync: true,
  model: 'anthropic/claude-haiku-4-5', // per-call override
});

// summary is typed as z.infer<typeof SummarySchema> — no casting.
await db.summaries.insert({
  ticketId: ticket.id,
  title: summary.title,
  bullets: summary.bullets,
  sentiment: summary.sentiment,
});

await session.close();
```

### 12.4 Headless script — streaming

`message({ stream: true })` is signal-driven and always accepted. The returned `AgentStream` represents the turn that answers this signal — chunks emit as the model produces them, even if the run was already in flight when the signal landed.

```ts
const session = await harness.session({ resourceId: 'cron:report-builder' });

const stream = session.message({ content: 'Generate the weekly report', stream: true });
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

If a programmatic caller specifically wants a **clean turn boundary** (no concurrent inputs interleaved into the response), pair `sync: true` with `output: schema` (§12.3) instead — but that form does not stream.

### 12.5 Using a skill

```ts
const result = await session.useSkill('summarize-pr', {
  args: {
    repo: 'mastra/mastra',
    prNumber: 4521,
    style: 'concise',
  },
  output: z.object({
    title: z.string(),
    risk: z.enum(['low', 'medium', 'high']),
    suggestedReviewers: z.array(z.string()),
  }),
});
// result.title, result.risk, result.suggestedReviewers all typed.
```

### 12.6 Per-turn overrides

```ts
// Use a faster model for this one turn, without changing the session default.
await session.message({
  content: 'Quick: what file owns the auth flow?',
  model: 'anthropic/claude-haiku-4-5',
});

// Add an extra tool just for this turn — typed result via `output` requires `sync: true`.
const audit = await session.message({
  content: 'Audit the security policy',
  addTools: { auditTool },
  output: AuditSchema,
  sync: true,
});

// Bypass approvals for an automated cleanup task.
await session.message({
  content: 'Delete all stale temp files in /tmp',
  yolo: true,
});

// Switch mode for one turn (e.g. drop into "plan" mode for a single planning question).
await session.message({
  content: 'Plan the migration before we start',
  mode: 'plan',
});
```

### 12.7 Permissions

```ts
// Grant a tool for this session only (until close).
session.permissions.grantTool({ toolName: 'workspace_execute_command' });

// Revoke a previous grant.
session.permissions.revokeTool({ toolName: 'workspace_execute_command' });

// Set a category-level policy.
session.permissions.setPolicy({
  category: 'destructive',
  policy: 'ask',
});

// Inspect what's currently granted.
const grants = session.permissions.getGrants();
```

### 12.8 Subagents and depth

```ts
const harness = new Harness({
  ...config,
  subagents: {
    maxDepth: 2, // parent → child → grandchild allowed; great-grandchild blocked
  },
});

session.subscribe((event) => {
  if (event.type === 'subagent_start') {
    console.log(
      `[depth=${event.depth}] subagent ${event.agentType} started`,
      event.parentId ? `(parent=${event.parentId})` : '(root)',
    );
  }
});
```

### 12.9 Sandbox command registry

```ts
import { LocalSandbox } from '@mastra/core/workspace';

const sandbox = new LocalSandbox({
  commandPolicy: 'restricted',
  commands: {
    npm: null, // bare allow — no env, no custom executor
    gh: { env: { GH_TOKEN: process.env.GH_TOKEN } },
    git: { description: 'Git CLI, available read-only', env: { GIT_TERMINAL_PROMPT: '0' } },
  },
});

// Programmatic: register at runtime.
sandbox.defineCommand('deploy', {
  execute: async (args, opts) => {
    // Custom executor — could call an internal API, mock for tests, etc.
    const result = await deployService.run(args);
    return { stdout: result.log, stderr: '', exitCode: result.code };
  },
  description: 'Trigger an internal deploy. Args: <env> <service>',
});
```

### 12.10 Cross-session orchestration

Spawn a child session for a one-shot job without disturbing the parent conversation.

```ts
async function runBackgroundAnalysis(parent: Session, document: string) {
  const child = await harness.session({
    resourceId: parent.resourceId,
    parentSessionId: parent.id,
    threadId: { fresh: true },
  });

  try {
    return await child.message({
      content: `Analyze this document and return findings:\n\n${document}`,
      output: AnalysisSchema,
      sync: true, // typed extraction → fresh runId, clean turn boundary
    });
  } finally {
    await child.close();
  }
}
```

### 12.11 Waiting and inspecting

```ts
if (session.isBusy()) {
  await session.waitForIdle({ timeout: 30_000 });
}

console.log({
  queueDepth: session.getQueueDepth(),
  currentRunId: session.getCurrentRunId(),
  currentTraceId: session.getCurrentTraceId(),
  tokenUsage: session.getTokenUsage(),
});
```

### 12.12 Observational Memory

```ts
// Inspect or change OM models for this session only.
const observerModelId = session.om.getObserverModelId();
await session.om.switchObserverModel({ model: 'anthropic/claude-haiku-4-5' });

// Read the current OM record for the session's resource.
const record = await session.om.getRecord();
```

### 12.13 Workspace ownership shapes

```ts
import { Harness, LocalWorkspace } from '@mastra/core/harness/v1';
import { E2BWorkspace } from '@mastra/workspace-e2b';

// Shape 1 — shared (single-user TUI). Sugar form: bare Workspace.
new Harness({
  /* ... */
  workspace: new LocalWorkspace({ basePath: process.cwd() }),
});

// Shape 2 — per-resource (multi-tenant server).
new Harness({
  /* ... */
  workspace: {
    kind: 'per-resource',
    create: async ({ resourceId }) => {
      return new LocalWorkspace({ basePath: `/workspaces/${resourceId}` });
    },
  },
});

// Shape 3 — per-session (Devin-style), durable across server restarts.
// Use the full `WorkspaceProvider` shape so the harness can validate
// resumability at startup and persist provider state.
import { e2bWorkspaceProvider } from '@mastra/workspace-e2b';

new Harness({
  /* ... */
  workspace: {
    kind: 'per-session',
    provider: e2bWorkspaceProvider({ template: 'node-22' }),
    // The provider exposes:
    //   providerId: 'e2b'
    //   resumable: true
    //   create({ sessionId, ... })            -> live Workspace
    //   resume({ state, sessionId, ... })     -> live Workspace
  },
});

// Sugar form (factory shorthand). Equivalent to a `WorkspaceProvider` with
// `resumable: false` — sessions provisioned this way DO NOT survive server
// restarts. Use it for ephemeral workloads only.
new Harness({
  /* ... */
  workspace: async ({ sessionId }) => {
    return E2BWorkspace.create({ template: 'node-22', name: sessionId });
  },
});

// Tearing down a per-resource workspace (e.g. user deleted their account).
// Throws if any session for that resource is still live; close them first.
await harness.destroyResourceWorkspace({ resourceId: 'tenant-42' });
```

### 12.14 File attachments

```ts
import fs from 'node:fs/promises';

const session = await harness.session({ resourceId: 'local-user' });

// Inline form — the harness flushes bytes to the attachment store before
// queuing, so this survives a server restart.
const screenshot = await fs.readFile('./screenshot.png');
session.queue({
  content: 'What does this UI bug look like?',
  files: [
    { kind: 'inline', name: 'screenshot.png', mimeType: 'image/png', data: screenshot },
  ],
});

// URL form — for assets already hosted somewhere reachable. The reference
// is stored as-is; bytes never touch harness storage.
session.queue({
  content: 'Compare this design to the current implementation',
  files: [
    { kind: 'url', name: 'figma-export.png', mimeType: 'image/png', url: 'https://cdn.example.com/asset/abc.png' },
  ],
});

// Pre-upload form — useful for browser drag-drop with progress UI.
const { attachmentId } = await session.uploadAttachment({
  name: 'logs.txt',
  mimeType: 'text/plain',
  data: largeBuffer,
  onProgress: (loaded, total) => console.log(`${(loaded / total * 100).toFixed(1)}%`),
});

session.queue({
  content: 'Find the root cause in these logs',
  files: [
    { kind: 'ref', name: 'logs.txt', mimeType: 'text/plain', attachmentId },
  ],
});

// The attachment lives until the session is closed, or you can drop it early.
await session.deleteAttachment({ attachmentId });
```

### 12.15 Full suspension and approval lifecycle

This example walks through every interruption shape end-to-end: **tool approval**, **mid-execution suspension**, **a question raised by `ask_user`**, and **a `submit_plan` approval gate** — including a server crash midway through and a clean resume on a different process.

The point is to show that all four shapes are the same underlying mechanism: the agent's workflow snapshot is parked in `MastraStorage.workflows` keyed by `runId`, the session record carries the `runId` plus enough UX state to render the prompt, and `agent.resumeStream(...)` continues from the snapshot once the human answers.

```ts
import { Harness, HarnessSessionNotFoundError } from '@mastra/core/harness/v1';

const harness = new Harness(config);
await harness.init();

const session = await harness.session({
  resourceId: 'user-123',
  threadId: { fresh: true },
  sessionId: 'session-abc',
});

// One subscriber drives all interrupt UX.
session.subscribe(async (event) => {
  switch (event.type) {
    case 'tool_approval_required': {
      // Model wants to call a tool whose category resolves to 'ask'.
      // Render UI, wait for the human, respond.
      const decision = await ui.askApproval({
        toolName: event.toolName,
        input: event.input,
        category: event.toolCategory,
      });
      session.respondToToolApproval({
        toolCallId: event.toolCallId,
        decision,                          // 'approve' | 'decline' | 'always_allow_category'
      });
      break;
    }

    case 'tool_suspension_required': {
      // A long-running tool paused itself with `suspend(data)` and is
      // waiting for an out-of-band signal (e.g., a webhook landed).
      const resumeData = await ui.collectSuspensionResolution({
        toolName: event.toolName,
        suspendData: event.suspendData,
      });
      await session.respondToToolSuspension({
        toolCallId: event.toolCallId,
        resumeData,
      });
      break;
    }

    case 'question_pending': {
      // `ask_user` was invoked.
      const answer = await ui.ask({
        question: event.question,
        options: event.options,
        selectionMode: event.selectionMode,
      });
      session.respondToQuestion({ answer });
      break;
    }

    case 'plan_approval_required': {
      // `submit_plan` was invoked. Approval flips the session into build mode.
      const { approved, reason } = await ui.reviewPlan({
        title: event.title,
        plan: event.plan,
      });
      await session.respondToPlanApproval({ approved, reason });
      break;
    }
  }
});

// Kick off a turn that will exercise all four shapes.
session.queue({
  content: 'Refactor the billing service. Plan first, ask before destructive changes.',
});

// ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// What happens behind the scenes:
//
//   1. Agent calls `submit_plan` → harness emits `plan_approval_required`,
//      persists `pendingPlan = { runId, toolCallId, title, plan, source: 'parent' }`
//      to the SessionRecord. Workflow snapshot lives in MastraStorage.workflows.
//      User clicks "approve" → harness calls `agent.resumeStream({ approved: true }, { runId })`.
//      Mode flips to 'build'.
//
//   2. Agent calls `mastra_workspace_execute_command('rm -rf packages/legacy/')`.
//      The `mutation` category resolves to 'ask' → harness emits
//      `tool_approval_required`, persists `pendingApproval`. User declines →
//      `agent.resumeStream({ approved: false }, { runId })` — model continues
//      without the tool result.
//
//   3. Agent calls `ask_user('Which billing provider?')` → `question_pending`,
//      persists `pendingQuestion`. User answers → resume continues.
//
//   4. Agent invokes a long-running tool that calls `suspend({ webhookUrl })`.
//      Harness emits `tool_suspension_required`, persists `pendingSuspension`.
//      External webhook posts result → `respondToToolSuspension(...)` resumes.
//
// Crash recovery: if the server dies after step 1's snapshot is written but
// before the user approves, the SessionRecord still holds the `pendingPlan`
// and `runId`. On the next process:
// ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

// Different process — server restarted.
const harness2 = new Harness(config);
await harness2.init();

const session2 = await harness2.session({ sessionId: 'session-abc' });

// Display state has been rehydrated from the SessionRecord — the pending plan
// is still there, untouched.
const display = session2.getDisplayState();
if (display.pendingPlan) {
  const { approved } = await ui.reviewPlan({
    title: display.pendingPlan.title,
    plan: display.pendingPlan.plan,
  });
  // `respondToPlanApproval` looks up the persisted runId and calls
  // `agent.resumeStream(...)` — the conversation continues exactly where it
  // paused, even though we're in a fresh process.
  await session2.respondToPlanApproval({ approved });
}
```

**What's persisted vs. transient.** Across the suspension boundary:

| Layer | Persisted | Transient |
|---|---|---|
| Agent workflow snapshot | `MastraStorage.workflows[runId]` | — |
| UX prompt state | `SessionRecord.pendingApproval / pendingSuspension / pendingQuestion / pendingPlan` | — |
| Queue (typed-ahead) | `SessionRecord.pendingQueue` | — |
| Subscriber callbacks | — | rebuilt on `session.subscribe(...)` after rehydration |
| `AbortController`, in-flight promises | — | discarded on dehydration |

If the human never returns, the pending suspension stays parked in storage indefinitely. `harness.closeSession({ sessionId })` is the only operation that drops it (along with the workflow snapshot via cascade) — see §5.5.

### 12.16 Concurrent multi-user fan-in

Multiple users (or multiple devices for one user) sending into the same session concurrently. With agent signals, every `message(...)` call is accepted regardless of run state, and concurrent inputs interleave into the live run as additional user input. No queueing, no failures, no contention.

```ts
// Shared support thread; three users all chat into it from different tabs.
const session = await harness.session({ sessionId: 'support-thread-42' });

// All three calls return immediately; each promise resolves when the
// assistant turn answering THAT specific signal completes. Some calls may
// share an underlying assistant turn if the model batches them.
const [a, b, c] = await Promise.all([
  session.message({ content: 'I think the auth flow is broken' }),
  session.message({ content: 'Yeah, I just got logged out too' }),
  session.message({ content: 'Same here, started ~3 minutes ago' }),
]);

// If you need strict sequencing instead — each prompt as its own turn — use
// queue. Useful for scripts; almost never what you want for chat UI.
await session.queue({ content: 'Step 1: investigate' });
await session.queue({ content: 'Step 2: write a postmortem' });
await session.queue({ content: 'Step 3: file a follow-up ticket' });
```

The mental model: `message` is for "send this whenever the agent can pick it up" (chat); `queue` is for "wait for idle, then run as a standalone turn" (scripts).

### 12.17 Goals (Ralph loop)

Drive a session toward a long-horizon objective using a separate judge model. The user can interject at any time — their input preempts the next continuation cleanly because continuations land in the queue, not inline.

```ts
const session = await harness.session({ resourceId: 'user-123' });

// Render goal/judge state in the UI.
session.subscribe((event) => {
  switch (event.type) {
    case 'goal_set':
      ui.statusLine.set(`goal: ${event.goal.objective}`);
      break;
    case 'goal_judged':
      ui.statusLine.set(
        `judge ${event.turnsUsed}/${event.maxTurns} — ${event.decision.decision}`,
      );
      break;
    case 'goal_done':
      ui.toast(`goal done after ${event.turnsUsed} turns: ${event.reason}`);
      break;
    case 'goal_paused':
      ui.toast(`goal paused (${event.reason})`);
      break;
  }
});

// Kick off the Ralph loop. The judge model sees the conversation context
// after every assistant turn and decides done / continue / waiting.
session.setGoal({
  objective:
    'Refactor the billing service to use the new pricing engine. Run tests after each step and stop when CI passes locally.',
  judgeModel: 'anthropic/claude-haiku-4-5',
  maxTurns: 50,
  judgeAnswersQuestions: true, // judge auto-answers `ask_user` prompts so the loop stays autonomous
});

// First turn — the model starts working. After it finishes, the harness
// invokes the judge. If the judge says `continue`, the harness enqueues the
// continuation reason as the next message via session.queue(...).
await session.message({ content: 'Begin.' });

// User changes their mind mid-loop. The next continuation will run AFTER
// this message, because user input always preempts auto-continuations.
await session.message({ content: 'Actually, focus on the proration bug first.' });

// Pause without losing the goal — useful for triaging an unrelated bug.
session.pauseGoal();
await session.message({ content: 'Quick — what does line 42 of pricing.ts do?' });
session.resumeGoal();

// Done.
session.clearGoal();
```

**Important behaviours:**

- Continuations are queued, not inlined. A typed-ahead `queue(...)` item still runs before the next continuation.
- A `message(...)` posted while the judge is mid-evaluation is accepted normally; the judge's eventual `continue` reason is appended after that user message in the queue.
- If the goal is cleared or replaced while the judge is still running, the judge's result is dropped silently.
- Budget exhaustion (`turnsUsed >= maxTurns`) pauses the goal with `reason: 'budget_exhausted'`; raise the cap and call `resumeGoal()` to keep going.
- Judge failures pause the goal with `reason: 'judge_failed'` and emit an `error` event. No silent retry loop.

---

## 13. Mastra Server integration

A `Harness` is registered on a `Mastra` instance the same way agents and workflows are. The server auto-mounts a stable HTTP surface, and consumers can talk to the harness either in-process (via `mastra.getHarness(...)`) or remotely (via the client SDK). Code that holds a `Session` reference doesn't care which.

### 13.1 Registration

```ts
import { Mastra } from '@mastra/core';
import { Harness } from '@mastra/core/harness/v1';

const codingHarness = new Harness(codingConfig);
const supportHarness = new Harness(supportConfig);

const mastra = new Mastra({
  agents: { /* ... */ },
  workflows: { /* ... */ },
  harness: {
    coding: codingHarness,
    support: supportHarness,
  },
});

// In-process access — same shape as `getAgent`, `getWorkflow`, etc.
const harness = mastra.getHarness('coding');
const session = await harness.session({ resourceId });
```

Single-harness sugar for the common case:

```ts
new Mastra({ harness: codingHarness });
// equivalent to:
new Mastra({ harness: { default: codingHarness } });

mastra.getHarness();           // returns the default harness
mastra.getHarness('default');  // same
```

`mastra.init()` calls `harness.init()` on every registered harness. `mastra.shutdown()` calls `harness.shutdown()` on every registered harness.

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

### 13.3 Wire protocol (sketch)

The implementation contract — not a user-facing API. Consumers use the SDK (§13.4); only client implementers in other languages or version-skew debuggers care about the wire shape directly.

**Request payloads** mirror the in-process option types one-to-one. Example for `POST /messages`:

```ts
// Request body — application/json
interface MessageRequest {
  content: string;
  files?: WireAttachment[];
  output?: { schema: JsonSchema };  // Zod schema serialized to JSON Schema
  // Per-turn overrides
  model?: string;
  mode?: string;
  yolo?: boolean;
  // addTools is not sendable over the wire — see §13.5
}

type WireAttachment =
  | { kind: 'inline'; name: string; mimeType: string; data: string /* base64 */ }
  | { kind: 'url'; name: string; mimeType: string; url: string }
  | { kind: 'ref'; name: string; mimeType: string; attachmentId: string };
```

For larger payloads, the route also accepts `multipart/form-data`: a JSON `payload` part (containing the `MessageRequest` minus `files`) plus one file part per attachment. The server promotes uploaded files into pre-stored attachments and rewrites the message to use `kind: 'ref'` references before queuing.

**Event envelope** for SSE streams:

```
id: <epoch>-<seq>
event: <event-type>
data: <json>
```

Each event includes an epoch-prefixed, session-scoped ID (see §10.5). `epoch` is regenerated on every cold start of the in-memory Session instance — initial hydration, re-hydration after eviction, or hydration after a process restart — and `seq` is monotonic within the epoch.

Resume on reconnect uses the standard `Last-Event-ID` header. The server keeps an in-memory ring buffer per Session instance (configurable, default 1000 events; `sessions.eventBufferSize` in §9) and applies the replay rules from §10.5:

- Same epoch, `seq` inside the buffer → replay newer entries, then live-tail.
- Same epoch, `seq` older than the buffer → `412 Precondition Failed` (buffer overflow).
- Different epoch → `412 Precondition Failed` (the previous in-memory buffer is gone).
- Missing or malformed `Last-Event-ID` → live-tail from now, no replay.

In any `412` case the client is expected to refetch state via `GET /sessions/:sessionId` and resubscribe. Durable replay across restarts is **not** a v1 feature; the SSE buffer is in-memory and best-effort. Clients that need history beyond the live buffer should fetch `GET /sessions/:sessionId/messages` for the persisted message log.

**Error envelope:**

The envelope is a discriminated union on `code`. Each `code` corresponds one-to-one with a typed error class in §4.5; the SDK rehydrates the response into an instance of that class with the `details` fields populated. The set of codes is **stable** — adding a new code is a wire-protocol change.

```ts
interface HarnessErrorResponseBase {
  message: string;                 // Human-readable. Not part of any contract;
                                   // SDK callers should branch on `code`, not `message`.
  retryable?: boolean;             // Optional advisory. Servers may set this for
                                   // transient failures (e.g. storage outages); SDKs
                                   // may use it to drive automatic retry/backoff.
}

type HarnessErrorResponse = HarnessErrorResponseBase & (
  // ── Admission failures (4xx) ────────────────────────────────────────────
  | { code: 'harness.busy';                    // → HarnessBusyError (only on `message({ sync: true })`,
                                               //   `message({ stream: true })`, and `useSkill(...)`)
      details: { sessionId: string;
                 reason: 'in_flight' | 'pending_approval' | 'pending_question' | 'pending_plan' } }
  | { code: 'harness.queue_full';              // → HarnessQueueFullError
      details: { sessionId: string; maxQueueDepth: number; currentDepth: number } }
  | { code: 'harness.validation';              // → HarnessValidationError
      details: { field: string; reason: string } }
  | { code: 'harness.override_conflict';       // → HarnessOverrideConflictError
      details: { sessionId: string; activeRunId: string;
                 conflictingFields: Array<'model' | 'mode' | 'addTools'> } }
  | { code: 'harness.subagent_depth_exceeded'; // → HarnessSubagentDepthExceededError
      details: { maxDepth: number; attemptedDepth: number } }
  | { code: 'harness.skill_not_found';         // → HarnessSkillNotFoundError
      details: { skillName: string;
                 searchedSources: Array<'code-registered' | 'workspace'> } }

  // ── Session lifecycle (4xx) ─────────────────────────────────────────────
  | { code: 'harness.session_not_found';       // → HarnessSessionNotFoundError
      details: { sessionId: string } }
  | { code: 'harness.session_closed';          // → HarnessSessionClosedError
      details: { sessionId: string } }
  | { code: 'harness.session_locked';          // → HarnessSessionLockedError
      details: { sessionId: string; currentOwnerId: string; expiresAt: number } }
  | { code: 'harness.aborted';                 // → HarnessAbortedError
      details: { sessionId: string;
                 reason: 'agent_aborted' | 'parent_aborted' | 'session_closed' | 'process_restart';
                 parentSessionId?: string } }

  // ── Workspace (4xx) ─────────────────────────────────────────────────────
  | { code: 'harness.workspace_provider_mismatch'; // → HarnessWorkspaceProviderMismatchError
      details: { sessionId: string; storedProviderId: string; configuredProviderId: string } }
  | { code: 'harness.workspace_lost';          // → HarnessWorkspaceLostError
      details: { sessionId: string; providerId: string; reason: 'restart' | 'eviction' } }

  // ── Persistence (5xx, retryable) ────────────────────────────────────────
  | { code: 'harness.storage';                 // → HarnessStorageError
      details: { sessionId: string; operation: 'flush' | 'load' | 'attachment' } }
  | { code: 'harness.session_corrupt';         // → HarnessSessionCorruptError
      details: { sessionId: string; reason: 'parse_failed' | 'schema_incompatible' } }
  | { code: 'harness.state_serialization';     // → HarnessStateSerializationError
      details: { sessionId: string; path: string } }

  // ── Server-layer (no typed class; SDK throws a generic Error) ───────────
  | { code: 'harness.permission_denied';       // Auth/tenancy boundary, set by the server middleware.
      details?: { sessionId?: string; resourceId?: string } }
  | { code: 'harness.bad_request';             // Malformed HTTP request (bad JSON, missing route param).
                                               // Distinct from `harness.validation`, which is harness-layer
                                               // admission for well-formed requests.
      details?: Record<string, unknown> }
  | { code: 'harness.internal';                // Catch-all for unhandled server exceptions.
      details?: { traceId?: string } }
);
```

The `details` field on a response is fully typed by the discriminated `code`; SDK rehydration is a switch on `code` that constructs the matching `Harness*Error` subclass with the corresponding fields. The set of codes deliberately mirrors the typed class hierarchy in §4.5 — adding a new typed error class therefore requires adding a new code to this union.

**Local-only errors not represented on the wire.** `HarnessConfigError` (§4.5) is intentionally not wire-representable. It is a startup-time failure: a misconfigured workspace provider, missing required field, or unresumable provider declared without a fallback prevents `harness.init()` from succeeding, and therefore prevents the Mastra Server from accepting requests at all. By the time a client could issue an HTTP call, this class of error has already aborted server boot. There is no other typed error in §4.5 that is intentionally local-only.

### 13.4 Client SDK

`@mastra/client-js` exposes a `HarnessClient` with the same surface as the in-process `Harness` — minus the parts that don't translate over the wire (workspace direct access, in-process subscriptions to non-session events, etc., see §13.5).

```ts
import { MastraClient } from '@mastra/client-js';

const mastra = new MastraClient({ baseUrl: 'https://mastra.example.com' });
const harness = mastra.getHarness('coding');

// Same shape as in-process. `session` is a `RemoteSession` that proxies
// every call to the server.
const session = await harness.session({ sessionId });

session.subscribe(event => render(event));
await session.queue({ content: 'Refactor auth' });
```

**`RemoteSession`** implements the wire-safe subset of `Session`'s methods (the `RemoteSafeSession` interface — §2.6, §13.5). Each method either:

- POSTs/PATCHes to the corresponding route and returns the deserialized result, or
- (for `subscribe`) opens an SSE connection to `/events`, dispatches events to the listener, and returns an unsubscribe function.

Methods listed in §13.5 (raw `getWorkspace`, function-valued `addTools`, `onInterval`, cross-session subscriptions, the functional form of `setState`, and `refreshSkills`) are absent from the `RemoteSession` type. Reaching for them on a remote session fails to type-check.

**Reconnection** is automatic. If the SSE stream drops, the client reconnects with `Last-Event-ID` and replays events newer than the last seen ID. If the supplied ID is from a previous epoch (server restart or session eviction) or older than the live buffer, the server returns `412 Precondition Failed`; the client transparently re-fetches state via `GET /sessions/:sessionId` and resumes from the new tail. See §10.5 for the full contract.

**Type compatibility.** Both `Session` (in-process) and `RemoteSession` implement `RemoteSafeSession`. Portable code should accept `RemoteSafeSession`. Code that needs the full local surface (workspace handles, interval handlers, function-valued tools) should accept `Session` and is not deployable as-is to a remote SDK consumer.

```ts
import type { RemoteSafeSession } from '@mastra/core/harness/v1';

// Portable: works against an in-process Session or a remote SDK session.
async function summarize(session: RemoteSafeSession) {
  return session.message({ content: 'Summarize the diff', output: SummarySchema, sync: true });
}

summarize(localSession);   // ✅
summarize(remoteSession);  // ✅

// Local-only: requires direct workspace access.
async function tarball(session: Session) {
  const ws = session.getWorkspace();           // not on RemoteSession
  return ws?.exec('tar', ['-czf', 'out.tgz', '.']);
}
```

### 13.5 What does not cross the wire

`RemoteSession` is defined as `Session` **minus** the surface listed below. These methods and fields are absent from the `RemoteSession` type, so calling them yields a TypeScript error rather than a runtime surprise. The remainder — what *does* cross the wire — is the shared `RemoteSafeSession` interface introduced in §2.6, and is the only surface that portable client code should depend on.

- **Direct workspace access** (`session.getWorkspace()`, `harness.getWorkspace()`, raw `Workspace` handles). The workspace lives server-side; the client interacts with it through tools, events, and the file-attachment routes. Direct handles would punch through the trust boundary.
- **Function-valued `addTools` per-turn override.** Tool implementations are closures, and closures don't serialize. Tools must be registered on the server-side `HarnessConfig`. `addTools` is already absent from `QueueOptions` everywhere (§4.4) — durable queued items can't represent a tool surface that storage can't reproduce. On `MessageOptions` and `UseSkillOptions` it's allowed in-process but omitted from the remote types, so reaching for it on a `RemoteSession` is a compile-time error. Per-turn `model`, `mode`, and `yolo` overrides still cross the wire.
- **Cross-session `harness.subscribe(...)` without a `sessionId` filter.** Subscribing to *every* session's events on a multi-tenant server would leak across tenants. Per-session `session.subscribe(...)` is exposed and rides the SSE route from §13.3.
- **Interval handlers** (`harness.onInterval`). Server-side concern; clients can't register code to run on the server.
- **The functional form of `setState`** (`setState(prev => next)`). The updater is a closure executed against live state under the session lease, and closures cannot be sent across the wire. The object form (`setState(patch)`) is on `RemoteSession` and rides the dedicated `PATCH /sessions/:sessionId/state` route (§13.2). Remote callers that need read-modify-write must `await session.getState()`, compute the next value locally, and PATCH the resulting patch. Note this is not atomic across concurrent remote writers — if that matters, fall back to `setState(prev => next)` in-process or model the field as something the server already serialises (a queued item, a goal, a permission grant) instead.

- **Non-JSON values inside `state`.** Functions, class instances, circular references, `Map`, `Set`, and `Date` do not round-trip. Same constraint as the in-process flush: violations reject with `HarnessStateSerializationError` (§5.7). Recommended: keep `state` to plain JSON shapes and put richer values behind ID references in workspace files, attachments, or your own datastore.
- **`session.refreshSkills()`.** Workspace skill discovery scans the server-side filesystem for `.claude/skills/<name>/SKILL.md`; only the server can run that scan, so the method is absent from `RemoteSession`. The `listSkills` / `getSkill` / `useSkill` reads remain — they serve from the cached scan, which the server populates on first access (§4.6). Remote products that want a manual refresh should expose a product-specific route that calls `session.refreshSkills()` server-side, or close and re-open the session.
- **Direct `HarnessStorage` access.** The remote SDK never exposes the storage interface; durable state is reached only through `Session` methods.

`RemoteSafeSession` is the interface name. Clients targeting both deployment shapes should declare their dependencies as `RemoteSafeSession`, not `Session`, to keep the local/remote distinction enforced at the type system.

**Asymmetric read shapes.** A handful of memory-served reads are sync on the in-process `Session` and async on `RemoteSession` — `getState`, `getDisplayState`. `RemoteSafeSession` widens these to async (`Promise<...>`) so portable code can be written once. In-process callers that prefer the cheaper sync read should narrow their parameter type to `Session` explicitly; portable code awaits.

### 13.6 Lifecycle and deployment

Mastra Server takes responsibility for `init` and `shutdown`. Consumers don't call `harness.init()` directly when running under the server — `mastra.init()` does it.

The eviction policy (§5.4) applies normally. Sessions that haven't been touched over their idle timeout are flushed and dropped from memory; subsequent SDK calls hydrate them transparently from storage. Clients see no difference.

For zero-downtime deploys, drain the server before shutdown: stop accepting new connections, let in-flight turns settle (with a timeout), then call `mastra.shutdown()`. Sessions persist; clients reconnect to the new server instance and resume.

### 13.7 File attachments

Two paths for sending an attachment with a message:

**(a) Inline.** Caller sends a single request with `Content-Type: multipart/form-data`. The JSON `payload` part carries the `MessageRequest` (with `files` omitted), and each file part is the raw bytes plus name + mimeType in the part headers. The server stores each file as an attachment and rewrites the message to use `kind: 'ref'` before queuing.

Trade-off: one round-trip, but the entire upload must complete before the message is queued. Best for small files (< 1 MiB) where round-trip latency dominates.

**(b) Pre-uploaded.** Caller first POSTs each attachment to `/harness/:name/sessions/:sessionId/attachments` (one multipart request per file), gets back an `attachmentId`, then POSTs the `MessageRequest` as JSON with `kind: 'ref'` entries. Pre-uploaded attachments are reachable from any subsequent message until the session is closed (or the caller deletes them via `DELETE /attachments/:attachmentId`).

Trade-off: two round-trips per file, but attachments can be uploaded in parallel, support resumable uploads if the storage adapter does, and survive client navigation. Best for large files, drag-drop UIs, and progress indicators.

Both paths enforce `HarnessConfig.files.maxInlineBytes` (§9). Larger files **must** be hosted externally and sent as `kind: 'url'`.

The SDK exposes both paths:

```ts
// (a) Inline — SDK picks multipart automatically when files are present.
await session.queue({
  content: 'Look at this screenshot',
  files: [{ kind: 'inline', name: 'screenshot.png', mimeType: 'image/png', data: bytes }],
});

// (b) Pre-uploaded — useful for browser drag-drop with progress UI.
const { attachmentId } = await session.uploadAttachment({
  name: 'screenshot.png',
  mimeType: 'image/png',
  data: bytes,
  onProgress: (loaded, total) => updateProgressBar(loaded / total),
});
await session.queue({
  content: 'Look at this screenshot',
  files: [{ kind: 'ref', name: 'screenshot.png', mimeType: 'image/png', attachmentId }],
});
```

Inline-form attachments coming through the in-process API (not the wire) follow the same flow internally: the harness writes them to `HarnessStorage.saveAttachment(...)` before persisting the queue item, then deletes them after the item is consumed.

Attachments are **session-scoped**. They cannot be referenced from a different session, even within the same resource. `harness.closeSession(...)` cascades to `deleteAttachmentsForSession(...)`.
