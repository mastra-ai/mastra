### 4.1 Harness

Orientation diagram (surface families only; the TypeScript API below remains
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-harness-api-title hx-harness-api-desc" viewBox="0 0 1040 430" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-harness-api-title">Harness public API surface</title>
    <desc id="hx-harness-api-desc">The Harness class exposes lifecycle, sessions, channels, threads, catalogs, event subscriptions, and background task observation as separate public surface families.</desc>
    <defs>
      <marker id="ah-harness-api" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="405" y="25" width="230" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="55" text-anchor="middle">Harness</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="78" text-anchor="middle">registered orchestration root</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="55" y="150" width="200" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="155" y="178" text-anchor="middle">Lifecycle</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="155" y="200" text-anchor="middle">init / shutdown</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="300" y="150" width="200" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="400" y="178" text-anchor="middle">Sessions</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="400" y="200" text-anchor="middle">resolve / list / close</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="545" y="150" width="200" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="645" y="178" text-anchor="middle">Channels</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="645" y="200" text-anchor="middle">ingest / action / outbox</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="790" y="150" width="200" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="890" y="178" text-anchor="middle">Threads</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="890" y="200" text-anchor="middle">history primitive</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="175" y="300" width="200" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="275" y="328" text-anchor="middle">Catalogs</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="275" y="350" text-anchor="middle">modes / models / skills</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="420" y="300" width="200" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="328" text-anchor="middle">Events</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="350" text-anchor="middle">harness subscriptions</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="665" y="300" width="200" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="765" y="328" text-anchor="middle">Background tasks</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="765" y="350" text-anchor="middle">scoped observation</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-harness-api);" d="M440 97 C340 120 210 125 165 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-harness-api);" d="M500 97 C455 120 420 130 405 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-harness-api);" d="M560 97 C605 120 635 130 640 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-harness-api);" d="M610 97 C720 120 850 125 885 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-harness-api);" d="M470 97 C350 170 285 235 275 299" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-harness-api);" d="M520 97 L520 299" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-harness-api);" d="M575 97 C690 170 755 235 765 299" />
  </svg>
  <figcaption>The public Harness class is a control surface over sessions and their ledgers; channel and background helpers stay scoped to Harness ownership.</figcaption>
</figure>

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
  //   - by (threadId, resourceId)  — find or create the active session bound to that thread
  //   - by resourceId alone        — bootstrap: most-recent-or-create
  //
  // The returned `Session` is always live in memory. Storage is consulted
  // transparently when the session isn't already hydrated. For a given
  // `(harnessName, resourceId, threadId)`, all callers attach to the same active
  // `SessionRecord`; v1 does not allow independent active session records
  // to share one thread. If the caller supplies `sessionId` for a
  // `(harnessName, resourceId, threadId)` pair already owned by a different active
  // session, resolution throws `HarnessSessionConflictError` instead of
  // creating a second active record or silently switching IDs.
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
  } & ListSessionsOptions): Promise<ListPage<SessionListItem>>;

  // Destructive session APIs. Multi-tenant callers pass `resourceId`; a
  // mismatch is surfaced as `HarnessSessionNotFoundError` before close/delete
  // or force-delete semantics run. The ID-only overloads are for single-tenant
  // local code and explicit operator/admin tooling; Mastra Server routes always
  // pass the auth-derived `resourceId`. `deleteSession` without `force` is a
  // guarded closed-record delete and throws `HarnessSessionDeleteBlockedError`
  // while dependent work remains non-terminal. `force: true` applies the
  // destructive cleanup rules in §5.5. `closeSession` is bounded by
  // `sessions.closeTimeoutMs`: it first exposes a Closing state, rejects new
  // work, aborts live work, and resolves only after terminal `closedAt` is
  // committed.
  closeSession(opts: { sessionId: string; resourceId: string }): Promise<void>;
  closeSession(opts: { sessionId: string }): Promise<void>;
  deleteSession(opts: { sessionId: string; resourceId: string; force?: boolean }): Promise<void>;
  deleteSession(opts: { sessionId: string; force?: boolean }): Promise<void>;

  // Channels — control-plane bridge for per-agent channel transports.
  // Used by channel adapters and Mastra Server webhook routes. The bridge
  // resolves platform identifiers into Harness sessions, admits inbound input
  // through `message` / `queue`, persists delivery state, and dispatches
  // durable outbound items. It does not expose AgentChannels internals and
  // does not let channels bypass Session ownership. See §14.
  channels: {
    resolveBinding(opts: ResolveChannelBindingOptions): Promise<ChannelBinding>;
    ingest(opts: ChannelIngressOptions): Promise<ChannelIngressResult>;
    respondToAction(opts: ChannelActionOptions): Promise<ChannelActionResult>;
    enqueueOutbox(opts: ChannelOutboxEnqueueOptions): Promise<{ outboxItemId: string }>;
    // Internal/operator recovery helper. Scans durable session/thread/run state
    // for one session, including descendant subagent sessions for prompt
    // projection, and recreates missing outbox rows idempotently.
    projectMissingOutboxItems(opts: { sessionId: string }): Promise<{
      enqueued: number;
      skipped: number;
      conflicts: number;
    }>;
    // Internal/operator worker helper, not an app-facing response path.
    // Per-harness dispatch always claims this harness's rows. Cross-harness
    // operator dispatch belongs to the Mastra Server channel registry (§14.4).
    dispatchOutbox(opts?: ChannelDispatchOptions): Promise<ChannelDispatchResult>;
  };

  // Threads (persistent storage primitive)
  threads: {
    create(opts: CreateThreadOptions & { resourceId: string }): Promise<HarnessThread>;
    // Same-resource thread copy. Creates a new thread and a full message-log
    // snapshot with fresh message IDs; it does not clone active sessions,
    // runtime state, channel rows, queue/pending work, workspace state, or
    // memory/OM rows. See §4.4 and §5.2.
    clone(opts: CloneThreadOptions & { resourceId: string }): Promise<HarnessThread>;
    get(opts: { threadId: string; resourceId: string }): Promise<HarnessThread | null>;
    list(opts: ListThreadsOptions & { resourceId: string }): Promise<ListPage<HarnessThread>>;
    rename(opts: { threadId: string; resourceId: string; title: string }): Promise<void>;
    delete(opts: { threadId: string; resourceId: string }): Promise<void>;
    listMessages(opts: { threadId: string; resourceId: string } & ListMessagesOptions): Promise<ListPage<HarnessMessage>>;
    getFirstUserMessage(opts: { threadId: string; resourceId: string }): Promise<HarnessMessage | null>;
    getFirstUserMessages(opts: { threadIds: string[]; resourceId: string }): Promise<Record<string, HarnessMessage | null>>;
  };

  // Catalogs
  listModes(): HarnessMode[];
  listAvailableModels(): Promise<AvailableModel[]>;
  listSkills(): HarnessSkill[];
  getSkill(name: string): HarnessSkill | undefined;
  getToolCategory(opts: { toolName: string }): ToolCategory | null;
  // Local/in-process convenience only. Returns the configured
  // `HarnessConfig.defaultResourceId`, or `undefined` when no default tenant is
  // configured. It does not infer from the registered `harnessName`, and it is
  // not a resource catalog or remote resource-authority surface (§13.2/§13.5).
  getDefaultResourceId(): string | undefined;
  // Local/operator compatibility helper for tests, CLIs, and TUIs. Returns
  // distinct resource IDs already observed in this in-process Harness's bound
  // thread index. This is not a storage resource catalog, not authorization
  // proof, not part of RemoteSession / ordinary client SDKs, and not an
  // auto-mounted client route. A configured default resource with no persisted
  // thread/session row is not implied by this list. Implementations must keep
  // the scan inside the current Harness namespace and may cap, return a
  // best-effort subset, or reject when an unbounded all-resource scan would be
  // unsafe.
  getKnownResourceIds(): Promise<string[]>;
  // No mutable default-model setter: default model policy is immutable
  // HarnessConfig bootstrapping policy (§9). Runtime model changes are
  // session-owned.

  // Intervals
  onInterval(handler: IntervalHandler): () => Promise<void>; // returns async unsubscribe
  stopIntervals(): Promise<void>;

  // Local/in-process control-plane stream. Receives harness-scoped events plus
  // a live fan-out copy of every session-scoped event from every live Session
  // owned by this Harness instance, including child/subagent sessions. See §10
  // for delivery, ordering, and replay boundaries. Not exposed remotely (§13.5).
  subscribe(listener: HarnessListener): () => void;

  // Workspace — out-of-session contexts only (init scripts, admin tooling, batch jobs).
  // Returns the shared workspace when the harness is configured with `kind: 'shared'`;
  // returns `undefined` for `per-resource` and `per-session` shapes.
  // In-process callers use `session.getWorkspace()` / `resolveWorkspace()`;
  // tools use the `HarnessRequestContext` projection of those accessors. See §2.7/§6.1.
  getWorkspace(): Workspace | undefined;
  resolveWorkspace(): Promise<Workspace | undefined>;
  hasWorkspace(): boolean;
  isWorkspaceReady(): boolean;

  // Per-resource teardown. Storage-checks persisted active sessions
  // (`closedAt: undefined`) for `resourceId`, including evicted sessions, and
  // rejects with `HarnessResourceWorkspaceInUseError` while any active session
  // may still use the workspace. The guard must be atomic with teardown or
  // backed by an equivalent teardown fence so a concurrent session creation
  // cannot race the destroy. No-op for `shared` and `per-session` shapes.
  // See §2.7.
  destroyResourceWorkspace(opts: { resourceId: string }): Promise<void>;

  // Infrastructure
  getMastra(): Mastra | undefined;
}
```
