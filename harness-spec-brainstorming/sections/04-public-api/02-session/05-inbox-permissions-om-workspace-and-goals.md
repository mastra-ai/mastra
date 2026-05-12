### 4.2e Inbox, Permissions, OM, Workspace, and Goals

Orientation diagram (permission gate decision only; the TypeScript method
signatures and prose below remain authoritative for inbox response,
observational memory, workspace, goal, and token-usage semantics):

<figure>
  <svg role="img" aria-labelledby="hx-permission-gate-title hx-permission-gate-desc" viewBox="0 0 1040 560" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-permission-gate-title">Permission gate decision</title>
    <desc id="hx-permission-gate-desc">Inputs drive effective policy resolution, then reason composition decides whether the tool is allowed, denied terminally, or held behind a pending approval. Two gates apply the same decision: pre-exposure before the model call and pre-action immediately before execution.</desc>
    <defs>
      <marker id="ah-permission-gate" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="40" y="28">Inputs (read from owning SessionRecord at decision time)</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="40" width="220" height="68" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="68" text-anchor="middle">Tool identity</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="88" text-anchor="middle">tool name + configured</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="102" text-anchor="middle">ToolCategory (no hierarchy)</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="280" y="40" width="220" height="68" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="390" y="68" text-anchor="middle">Session policy</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="88" text-anchor="middle">permissionRules +</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="102" text-anchor="middle">sessionGrants</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="520" y="40" width="220" height="68" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="630" y="68" text-anchor="middle">Harness defaults</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="88" text-anchor="middle">defaultPermissionPolicy +</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="102" text-anchor="middle">authorized per-run yolo</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="760" y="40" width="240" height="68" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="880" y="68" text-anchor="middle">Tool-owned approval</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="88" text-anchor="middle">static require flag +</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="102" text-anchor="middle">needsApprovalFn(args, ctx)</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2; rx: 14;" x="40" y="148" width="960" height="92" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="60" y="174">1 · Effective policy</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="200">resolve in order: per-tool rule → category rule → defaultPermissionPolicy → ask</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="222">deny is terminal: no pending approval, no grant or yolo override</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2; rx: 14;" x="40" y="266" width="960" height="92" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="60" y="292">2 · Reason composition</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="318">tool-config (static require) · tool-fn (callback returns true) · policy (effective ask, not converted by yolo or grant)</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="340">grants and per-run yolo suppress only the policy reason; they never suppress tool-owned reasons</text>

    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="40" y="380">Outcome</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2.2; rx: 14;" x="40" y="394" width="280" height="92" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="180" y="422" text-anchor="middle">deny → terminal refuse</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="180" y="446" text-anchor="middle">no pendingApproval created;</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="180" y="464" text-anchor="middle">tool hidden / call refused</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2.2; rx: 14;" x="340" y="394" width="380" height="92" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="530" y="422" text-anchor="middle">reason remains → pendingApproval</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="530" y="446" text-anchor="middle">snapshot reasons for display / event / audit;</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="530" y="464" text-anchor="middle">respond via respondToToolApproval(...)</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2.2; rx: 14;" x="740" y="394" width="260" height="92" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="870" y="422" text-anchor="middle">allow → execute</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="870" y="446" text-anchor="middle">grant / yolo cleared policy ask;</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="870" y="464" text-anchor="middle">no tool-owned reasons present</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-permission-gate);" d="M150 110 L300 147" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-permission-gate);" d="M390 110 L460 147" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-permission-gate);" d="M630 110 L580 147" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-permission-gate);" d="M880 110 L740 147" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-permission-gate);" d="M520 240 L520 265" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-permission-gate);" d="M250 358 L180 393" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-permission-gate);" d="M520 358 L530 393" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-permission-gate);" d="M800 358 L870 393" />

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="40" y="500" width="960" height="50" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="60" y="522">Two gates apply this same decision path</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="540">pre-exposure: filter the final tool surface before the model call · pre-action: re-evaluate immediately before local execute / resume</text>
  </svg>
  <figcaption>The permission gate reads the owning SessionRecord at decision time, composes effective policy and reasons from session, defaults, and tool-owned approval, and produces deny, pendingApproval, or allow; the same decision drives the pre-exposure and pre-action gates.</figcaption>
</figure>

```ts
  // Question / plan / tool resolution. Question and plan registration are
  // tool-context-only through `HarnessRequestContext` (§6.1); public `Session`
  // callers only respond to pending items. Each `respond...` method consumes
  // the corresponding pending shape on `SessionRecord` (§5.1) — clears the
  // field, updates the display snapshot, and resumes the underlying Mastra
  // workflow with the appropriate payload:
  //   respondToToolApproval   → consumes pendingApproval,    resumes with { approved, reason? }
  //   respondToToolSuspension → consumes pendingSuspension,  resumes with opaque resumeData
  //   respondToQuestion       → consumes pendingQuestion,    resumes with { answer }
  //   respondToPlanApproval   → consumes pendingPlan,        resumes with { approved, reason? }
  //
  //   `itemId` and `responseId` are optional only for direct in-process local
  //   calls already scoped to the single pending item of this kind. Retrying
  //   external transports such as channel buttons must provide both. Under the
  //   session lease the method verifies `itemId`, kind, `runId`, and
  //   `requestedAt`, rejects stale or conflicting responses, and also verifies
  //   that no other pending field owns the same run before resume. Ambiguous
  //   multiple-pending state for one run is `HarnessSessionCorruptError` /
  //   `pending_state_corrupt`, not a prompt selection rule. Once verified, the
  //   method clears the pending field, marks the current run `resuming`, and
  //   calls the Required Agent Resume Boundary below. Two-phase
  //   `InboxResponseReceipt` state, `HarnessRecoveryDeferredError`, recovery
  //   retry, and `resumeAttemptId = responseId` idempotency are owned by
  //   §5.1/§5.7 and the Required Agent Resume Boundary.
  respondToToolApproval(opts: ToolApprovalResponse & InboxResponseOptions): Promise<InboxResponseResult>;
  respondToToolSuspension(opts: ToolSuspensionResponse & InboxResponseOptions): Promise<InboxResponseResult>;
  respondToQuestion(opts: { answer: string | string[] } & InboxResponseOptions): Promise<InboxResponseResult>;
  respondToPlanApproval(opts: { approved: boolean; reason?: string } & InboxResponseOptions): Promise<InboxResponseResult>;
  // Remote clients may call these methods directly or through the §13.4
  // PendingInboxItem helper; the helper only chooses the owning session route
  // and preserves responseId idempotency, it does not change these semantics.

  // Permissions. Mutators write `SessionRecord.permissionRules` /
  // `SessionRecord.sessionGrants` and resolve only after the durable transition
  // commits under the session lease. On commit, `grantCategory` / `grantTool`
  // emit `permission_granted`, `revokeCategory` / `revokeTool` emit
  // `permission_revoked`, and `setPolicy` emits `permission_policy_changed`
  // (see §10.2). Validation, closed-session, ownership, or storage failures
  // reject before any permission event or display projection is emitted. Tool
  // approval evaluation is separate from route/resource/principal
  // authorization; remote calls must pass the §13.2 authorization matrix before
  // admission, and neither `yolo` nor grants can bypass that boundary.
  //
  // Fresh sessions start with empty `permissionRules` and `sessionGrants`.
  // Grant transitions add the named tool/category grant if absent; revoke
  // transitions remove only the matching grant and do not alter
  // `permissionRules` or consume existing pending approvals. `setPolicy(...,
  // { policy: 'ask' })` records an explicit ask rule; it is not an unset or
  // inherit operation.
  //
  // For an attempted tool call, the owning session resolves permission from the
  // tool name and configured category at the time the call is gated:
  //   1. A per-tool rule in `permissionRules.tools[toolName]`, when present.
  //   2. Otherwise, a category rule in `permissionRules.categories[category]`
  //      when the tool has a configured category.
  //   3. Otherwise, `HarnessConfig.defaultPermissionPolicy` when configured.
  //   4. Otherwise, `ask`.
  // An effective `deny` is terminal: the tool is refused without creating a
  // pending approval, and session grants or per-turn `yolo` cannot override it.
  // Approval composition is monotonic and additive across independent sources:
  // static tool config, a global static require-approval flag, or mapped SDK
  // static approval metadata adds a `tool-config` reason; a function-valued
  // tool approval callback such as `needsApprovalFn(args, context)` adds a
  // `tool-fn` reason only when it returns `true`; and effective policy `ask`
  // adds a `policy` reason unless authorized per-run `yolo` converts that
  // policy-level ask to allow. A callback returning `false` removes no other
  // reason, and a thrown or rejected callback fails closed by adding
  // `tool-fn`. Implementation sentinels used only to evaluate a function-valued
  // approval source are not themselves a separate `tool-config` reason. An
  // effective `allow`, matching tool grant, matching category grant, or
  // authorized `yolo` suppresses only the `policy` reason; it cannot suppress
  // tool-owned `tool-config` or `tool-fn` reasons. The harness creates
  // `pendingApproval` only when at least one approval reason remains, and the
  // pending item snapshots those reasons for display, event, audit, and
  // recovery projections. Tool categories are the fixed `ToolCategory` values
  // from §4.8 and have no hierarchy: the only category considered is the
  // tool's current configured category from §9. Tools without a category are
  // not implicitly always allowed; they use per-tool rules, tool grants,
  // `yolo` over policy `ask`, the default policy, the fallback `ask`, and any
  // tool-owned approval reasons.
  //
  // Runtime permission enforcement has two Harness-owned gates, both using the
  // same session-owned decision path above rather than processor output,
  // request-context data, or tool-supplied state as authority:
  //
  // 1. Pre-exposure gate. After static tools, per-turn `addTools`, processors,
  //    ToolSearch, `prepareStep`, workspace wrappers, subagent/forked toolset
  //    composition, `activeTools`, and `toolChoice` have produced the final
  //    step surface, but before any model/provider call, the harness filters
  //    that surface through the owning session's current permission decision.
  //    Effective `deny` tools are removed from `tools` and `activeTools`.
  //    Forced `toolChoice` values that name a denied or hidden tool reject with
  //    `HarnessForbiddenError` before provider execution. If the remaining
  //    `activeTools` / `toolChoice: 'required'` combination cannot be satisfied
  //    after filtering, the run fails closed rather than asking the provider to
  //    operate on an incoherent surface. Provider-executed tools are decided at
  //    this gate: effective `deny` is hidden, and any tool call that would
  //    still require Harness approval (`policy`, `tool-config`, or `tool-fn`)
  //    is not exposed for provider execution unless that provider path has a
  //    concrete approval interrupt that preserves the same pending-approval
  //    contract. Authorized per-run `yolo` may convert only the policy `ask`
  //    reason before exposure; it never exposes effective `deny` or suppresses
  //    tool-owned approval reasons.
  //
  // 2. Pre-action gate. Immediately before local tool execution, resume after
  //    approval/suspension, durable shared tool execution, or any direct tool
  //    action path, the harness re-evaluates against the owning session's
  //    current `SessionRecord.permissionRules` and `sessionGrants` plus the
  //    committed run's authorized `yolo` bit. This gate refuses effective
  //    `deny` without creating `pendingApproval`, even if a model emitted a
  //    hidden tool call, a direct path bypassed pre-exposure, or permissions
  //    changed between exposure and action. `allow` and matching grants run
  //    without a prompt. Remaining approval reasons create `pendingApproval`
  //    on the owning session, except that per-run `yolo` can skip only the
  //    policy `ask` reason. The gate reads the authoritative session row at
  //    action time; it does not depend on `SessionRecord.version` alone as a
  //    permission-specific revision.
  //
  // Dynamic discovery processors, including ToolSearch, are model-exposure
  // surfaces. Before a candidate name, description, suggestion, loaded-tool
  // status, or final merged tool entry is exposed, the processor resolves the
  // candidate's canonical configured tool identity and trusted configured
  // category, then delegates to the same session-owned permission/pre-exposure
  // decision path used by the runtime gate. Effective `deny` candidates are
  // treated as unavailable, including exact name/id load requests; failure
  // messages and result metadata must not name, count, or suggest denied
  // candidates. Candidates whose trusted identity or category metadata is
  // insufficient for pre-exposure evaluation are not indexed, returned,
  // suggested, or loaded until that metadata can be evaluated; materialization-
  // time checks may only fail closed. Resolver and loaded-tool caches are scoped
  // to one owning session plus permission/session-version snapshot and include
  // run-scoped inputs such as `yolo` when those inputs affect the decision. They
  // invalidate on permission/session mutation. The final HC-320 pre-exposure
  // gate still validates ToolSearch meta-tools, loaded tools, `activeTools`, and
  // forced `toolChoice` before model/provider execution. This is not a separate
  // permission DSL or storage revision; it is the dynamic-discovery use of the
  // canonical decision path above.
  //
  // `respondToToolApproval(...)` consumes only the pending item it names. A
  // one-off approval does not mutate `SessionRecord.sessionGrants` or
  // `permissionRules`; "always allow" UI affordances must perform an explicit
  // `grantTool(...)` or `grantCategory(...)` transition in addition to answering
  // the pending item. Subagent tool calls resolve against the owning child
  // session record at both enforcement gates; parent grants, rules, and
  // `yolo` are not inherited unless copied by an explicit session mutation.
  // Parent and subagent-tool allowlists are delegation caps on what can be
  // exposed to the child; they do not grant action authority. The child
  // pre-exposure gate filters the capped child surface, and the child
  // pre-action gate uses only the child `SessionRecord.permissionRules` and
  // `sessionGrants`.
  permissions: {
    grantCategory(opts: { category: ToolCategory }): Promise<void>;
    grantTool(opts: { toolName: string }): Promise<void>;
    revokeCategory(opts: { category: ToolCategory }): Promise<void>;
    revokeTool(opts: { toolName: string }): Promise<void>;
    getGrants(): Readonly<SessionGrants>;
    setPolicy(opts: { category: ToolCategory; policy: PermissionPolicy }): Promise<void>;
    setPolicy(opts: { toolName: string; policy: PermissionPolicy }): Promise<void>;
    getRules(): Readonly<PermissionRules>;
  };

  // Observational Memory. OM is advisory memory context (§1), not a session
  // recovery proof boundary. Reads below are resolved against the verified
  // session resource/thread and the configured OM scope; mutators are
  // session-config writes and resolve only after the SessionRecord transition
  // commits under the session lease. They do not mutate raw memory rows.
  om: {
    getObserverModelId(): string | null;
    getReflectorModelId(): string | null;
    getObservationThreshold(): number;
    getReflectionThreshold(): number;
    switchObserverModel(opts: { model: string }): Promise<void>;
    switchReflectorModel(opts: { model: string }): Promise<void>;
    // Returns the redacted JSON-safe read model from §4.8, not the mutable
    // MemoryStorage row. The snapshot may include bounded, redacted active
    // observation text and bounded progress counters, but it must not expose
    // raw config blobs, metadata, buffered chunks/reflections, history
    // generations, live model objects, functions, locks, or processor
    // internals. Resource-scoped OM can summarize other threads for the same
    // authenticated resource; it never crosses the session's `resourceId`
    // boundary. Returns `null` when OM is disabled or no scoped record exists.
    getRecord(): Promise<ObservationalMemorySnapshot | null>;
    // OM refresh helper. It may reread OM/message progress into an
    // implementation-local cache, but it is advisory only: it does not mutate
    // SessionRecord.displayState, prove memory health, settle message/queue
    // operations, recover work, advance a durable lease, or block session
    // admission.
    loadProgress(): Promise<void>;
  };

  // Workspace — canonical session access path. Public in-process callers use
  // these methods directly; tools use the `HarnessRequestContext` projection
  // of the same resolver (§6.1). Returns the workspace
  // belonging to this session under the harness's configured ownership model
  // (`shared` | `per-resource` | `per-session`). See §2.7.
  //
  // `getWorkspace()` is non-blocking; returns `undefined` if the workspace
  // hasn't been materialised yet (lazy mode). Use `resolveWorkspace()` to
  // force provisioning. If persisted recovery has already proven the
  // per-session workspace is lost, both accessors throw
  // `HarnessWorkspaceLostError`; `resolveWorkspace()` must not provision a
  // replacement workspace for an existing active session whose workspace was
  // previously materialised.
  getWorkspace(): Workspace | undefined;
  resolveWorkspace(): Promise<Workspace>;
  hasWorkspace(): boolean;
  isWorkspaceReady(): boolean;

  // Attachments — pre-upload bytes that can later be referenced by ID from
  // any message on this session. Useful for browser drag-drop with progress
  // UIs and large files. Inline attachments on `message`/`queue`/`useSkill`
  // are flushed here implicitly; this method just exposes the pre-upload path.
  // See §13.7 for upload forms and URL ingestion; §5.1/§5.2 own the durable
  // `PersistedAttachment` shape, storage, and reference graph.
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
  // `continue` decision auto-enqueues a continuation message via ordinary FIFO
  // `queue(...)` with deterministic `continuation.admissionId`. See §4.7.
  setGoal(opts: SetGoalOptions): Promise<GoalState>;
  getGoal(): GoalState | null;
  pauseGoal(): Promise<GoalState | null>;
  resumeGoal(): Promise<GoalState | null>;
  clearGoal(): Promise<void>;

  // Token usage. Returns the session-owned usage projection, hydrated from
  // `SessionRecord.tokenUsage` and updated by live agent usage observations
  // before the debounced flush in §5.7. Remote and rehydrated reads use the
  // same projection and must not fall back to legacy thread metadata after an
  // active `SessionRecord` exists; §11.2 legacy metadata is bootstrap /
  // compatibility input only.
  getTokenUsage(): TokenUsage;

  // Lifecycle
  //
  // `close` is the ergonomic instance method for the common case where the
  // caller already has a `Session` reference. It delegates to
  // `harness.closeSession({ sessionId: this.id, resourceId: this.resourceId })`,
  // which remains the canonical implementation. ID-only close is reserved for
  // single-tenant local code and explicit operator/admin tooling; callers
  // iterating `harness.listSessions(...)` summaries should pass the summary's
  // `resourceId`.
  // Closing first makes the session observable as Closing, rejects new
  // mutations/admissions with `HarnessSessionClosingError`, aborts live work,
  // and then rejects pending queued items and unresolved accepted
  // signal-driven operations owned by this session through their matching
  // `message_failed` / `queue_failed` boundary before `closedAt` commits.
  close(): Promise<void>;
}
```
