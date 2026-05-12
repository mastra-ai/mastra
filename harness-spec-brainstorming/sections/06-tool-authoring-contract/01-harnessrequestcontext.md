### 6.1 `HarnessRequestContext`

Orientation diagram (context families only; interface fields below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-tool-context-title hx-tool-context-desc" viewBox="0 0 1040 470" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-tool-context-title">HarnessRequestContext field families</title>
    <desc id="hx-tool-context-desc">The tool context combines identity, application metadata, session state, lifecycle, events and suspension, channel metadata, subagent linkage, model resolution, and workspace access.</desc>
    <defs>
      <marker id="ah-tool-context" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="390" y="25" width="260" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="55" text-anchor="middle">HarnessRequestContext</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="78" text-anchor="middle">harness-created tool context</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="55" y="145" width="200" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="155" y="173" text-anchor="middle">Identity</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="155" y="195" text-anchor="middle">harness / session / thread</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="300" y="145" width="200" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="400" y="173" text-anchor="middle">App metadata</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="400" y="195" text-anchor="middle">read-only JSON bag</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="545" y="145" width="200" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="645" y="173" text-anchor="middle">State</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="645" y="195" text-anchor="middle">snapshot / get / set</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="790" y="145" width="200" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="890" y="173" text-anchor="middle">Lifecycle</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="890" y="195" text-anchor="middle">abortSignal</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="55" y="300" width="200" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="155" y="328" text-anchor="middle">Events &amp; suspension</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="155" y="350" text-anchor="middle">emit / ask / suspend</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="300" y="300" width="200" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="400" y="328" text-anchor="middle">Channel metadata</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="400" y="350" text-anchor="middle">transport-originated turns</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="545" y="300" width="200" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="645" y="328" text-anchor="middle">Subagent linkage</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="645" y="350" text-anchor="middle">depth / parent / source</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="790" y="300" width="200" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="890" y="328" text-anchor="middle">Workspace/model</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="890" y="350" text-anchor="middle">handle + resolver</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tool-context);" d="M430 97 C330 120 205 125 160 144" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tool-context);" d="M485 97 C445 120 415 125 405 144" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tool-context);" d="M555 97 C600 120 635 125 642 144" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tool-context);" d="M615 97 C720 120 850 125 885 144" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tool-context);" d="M430 97 C285 175 180 235 160 299" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tool-context);" d="M490 97 C430 175 405 235 400 299" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tool-context);" d="M555 97 C610 175 640 235 645 299" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-tool-context);" d="M615 97 C760 175 870 235 890 299" />
  </svg>
  <figcaption>The tool context is a per-turn capability bundle: it carries identity and live helpers while persistence remains owned by the session and storage contracts.</figcaption>
</figure>

**Relationship to Mastra `ToolExecutionContext`.** Mastra core already exposes
a tool execution surface at
`../packages/core/src/tools/types.ts:332`:

```ts
export interface ToolExecutionContext<TSuspend, TResume, TRequestContext>
  extends Partial<ObservabilityContext> {
  mastra?: MastraUnion;
  requestContext?: RequestContext<TRequestContext>;
  abortSignal?: AbortSignal;
  workspace?: Workspace;
  browser?: MastraBrowser;
  writer?: ToolStream;
  agent?: AgentToolExecutionContext<TSuspend, TResume>;     // legacy suspend/resume helpers
  workflow?: WorkflowToolExecutionContext<TSuspend, TResume>; // legacy suspend/resume helpers
  mcp?: MCPToolExecutionContext;
}
```

Harness v1 does not replace `ToolExecutionContext`; it populates a
Harness-owned typed slot inside the existing `requestContext` carrier. For
Harness-managed tool execution the adapter builds a **detached per-execution
`RequestContext` overlay** (never mutating the caller's `RequestContext` in
place — §6 and §11.1 forbid that), attaches `harness: HarnessRequestContext`,
and passes it as `context.requestContext`. Tools read the typed harness
surface with `context.requestContext.get('harness')` (§6, §11.1). The carrier
is Mastra's `RequestContext` class at
`../packages/core/src/request-context/index.ts:56`; the `'harness'` slot sits
next to the reserved `mastra__*` / `__mastra*` keys (§15.1 "Request context"),
not inside them, and both families are runtime-only (excluded from
`PersistedRequestContextInput`).

`context.mastra` is absent or an allowlist facade for Harness-managed
invocations (§6.3). The remaining fields follow ordinary Mastra semantics
when present: `workspace` is the resolved harness workspace handle (§2.7;
`../packages/core/src/workspace/workspace.ts:465`), `abortSignal` mirrors the
run's cancellation source (§4.5c), and `browser` follows the existing
Workspace browser contract. `writer?: ToolStream` and legacy `agent` /
`workflow` suspend/resume helpers are compatibility inputs only: harness v1
routes tool-emitted events through `emitCustomEvent` (below) and routes
`context.agent.suspend(...)` / `context.workflow.suspend(...)` through
`suspendTool` per §11.1 — they are not parallel APIs.

`ToolExecutionContext` is a compatibility input to the v1 contract, not a
substitute for `HarnessRequestContext`. A second internal interface named
`ToolExecutionContext` exists at
`../packages/core/src/agent/durable/workflows/shared/execute-tool-calls.ts:8`;
it is an internal durable-workflow orchestration context, not the public
tool-authoring surface, and the two share only the name (§11.6b).

```ts
interface HarnessRequestContext<TState = unknown> {
  // Identity — always populated.
  harnessName: string;
  harnessInstanceId: string;
  sessionId: string;
  threadId: string;
  resourceId: string;

  // Caller-provided application metadata from `requestContext.app`, after
  // canonical JSON validation. Detached and read-only for this tool turn.
  app?: Readonly<Record<string, JsonValue>>;

  // Current per-turn defaults (resolved with overrides applied).
  modeId: string;

  // User-defined session state.
  // `state` is the read-only snapshot captured when this context was built — it
  // reflects state at the start of the tool turn and does not update. To read
  // state that includes intra-turn `setState` calls, use `getState()`.
  state: ReadonlyState<TState>;
  getState: () => ReadonlyState<TState>;
  setState: SetStateFn<TState>;

  // Activity timeline. Read-only tool-context projection of the owning
  // Session accessor (§4.2d) and the redacted `SessionActivityTimeline`
  // read model (§5.1b.4). Present only on harness-created tool contexts
  // that carry an owning `sessionId` / `threadId` / `resourceId`; it gives
  // tools no richer view than the Session or `/activity` route surfaces.
  // Advisory only: timeline entries are not settlement proof, delivery proof,
  // work-claim evidence, OM ingestion inputs, or durable read-state anchors.
  getActivityTimeline: (opts?: ActivityTimelineOptions) => Promise<SessionActivityTimeline>;

  // Lifecycle.
  abortSignal: AbortSignal;

  // Eventing and suspension.
  // Registration methods are available only on a harness-created tool context
  // for an active run/tool call. They are not public Session, RemoteSession, or
  // wire APIs because the harness derives `runId`, `toolCallId`, pending
  // identity, owner session, and workflow suspension target from this context.
  emitCustomEvent: (event: HarnessCustomEventInput) => void;
  registerQuestion: (params: RegisterQuestionParams) => Promise<void>;
  registerPlanApproval: (params: RegisterPlanApprovalParams) => Promise<void>;
  suspendTool: (params: SuspendToolParams) => Promise<never>;

  // Channel metadata for turns that originated from, or are being delivered
  // back to, a channel transport. Absent for normal SDK/TUI calls. The
  // `ChannelRequestContext` shape and origin rules are defined in §14.3.
  channel?: ChannelRequestContext;

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

  // Workspace access. These are the tool-context projection of the owning
  // Session workspace accessors (§4.2): tools do not receive the full Session
  // object. `getWorkspace()` and `workspace` are non-materializing reads;
  // `resolveWorkspace()` is the explicit async materialization/resume path.
  hasWorkspace: () => boolean;
  isWorkspaceReady: () => boolean;
  getWorkspace: () => Workspace | undefined;
  resolveWorkspace: () => Promise<Workspace>;

  // Non-materializing snapshot captured when this context was built. Prefer
  // `resolveWorkspace()` for required filesystem / sandbox access.
  workspace?: Workspace;
}

// `setState` is overloaded. The overloads below are only the type surface;
// §6.2 owns tool-invocation behavior, and §5.1 owns storage-safe state
// validation plus object-form and functional-update commit semantics.
type SetStateFn<TState> = {
  (updates: Partial<TState>): Promise<void>;
  (updater: (prev: ReadonlyState<TState>) => TState): Promise<void>;
};

// JSON-serializable subset shared across custom events, suspension payloads,
// and any future tool-authored structures that must round-trip through storage.
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

// Tool-authored event input. The harness validates `type` and fills event and
// session identity fields (`id`, `sessionId`, `timestamp`, `resourceId`,
// `threadId`) before dispatching. The emitted event is `HarnessEventBase &
// CustomEvent` (§10.2), including §10.6 attribution when surfaced through a
// parent subagent stream.
// Rules for `type`:
//  - Must use a dotted custom prefix (e.g. `myorg.tool.progress`).
//  - Must not match any exact built-in event type (see §10.2) and must not start
//    with a reserved internal-prefix family: `agent_`, `text_`, `message_`,
//    `queue_`, `tool_`, `subagent_`, `state_`, `mode_`, `model_`, `session_`,
//    `token_`, `channel_`, `goal_`, `attachment_`, `display_`, `storage_`, or
//    the exact type `error`.
//  - Violations throw `HarnessValidationError` at call time.
interface HarnessCustomEventInput {
  type: CustomEventType;
  payload?: JsonValue;
}

// Tool-authored suspension. The harness writes `PendingToolSuspension` to
// `SessionRecord` under the session lease, then rejects with an internal
// interrupt to halt agent execution. The promise never resolves because the
// tool's execution is paused; the call site after
// `await suspendTool(...)` is unreachable. Tool authors MUST `await` or
// `return await` this call and MUST NOT catch the interrupt — the harness or
// workflow engine owns the suspension boundary.
//
// This is the v1 Harness-owned authoring API. Current Mastra
// `context.agent.suspend(...)` / `context.workflow.suspend(...)`,
// `resumeData`, `suspendSchema`, `resumeSchema`, and `SuspendOptions` are
// compatibility inputs only. A v1 adapter may expose or consume those current
// surfaces, but it must route them through this same session-lease pending
// registration path before delegating to the lower-level workflow suspension;
// they are not parallel Harness v1 APIs.
//
// Only one pending interaction per owning session/run is allowed. A second
// `registerQuestion`, `registerPlanApproval`, or `suspendTool` call within the
// same run rejects with `HarnessBusyError` before any durable write (the
// existing pending item already owns the run's interaction slot). The slot
// check and write happen in one session-lease transition, shared with
// harness-authored tool-approval gates. The error `reason` names that existing
// blocking kind (`pending_approval`, `pending_suspension`, `pending_question`,
// or `pending_plan`), not the attempted API. Parallel tool calls
// (`experimental_parallelToolCalls`) that attempt suspension/registration will
// see one win and the others rejected.
//
// `suspendData` MUST be JSON-serializable (`JsonValue`). Non-serializable
// values (functions, `undefined`, `BigInt`, class instances, circular refs)
// throw `HarnessValidationError`. Large payloads should go in workspace files
// or your own datastore — referenced from `suspendData` by ID.
// When a compatibility adapter has the current tool's `suspendSchema`, it must
// apply that schema before committing the pending suspension; otherwise v1
// validates only canonical JSON serializability at the Harness boundary.
//
// The tool author supplies only `suspendData`. Resume metadata such as a
// JSON-safe `resumeSchema` descriptor or `resumeLabel` is derived by the
// adapter from the registered tool / current `SuspendOptions` and persisted on
// `PendingToolSuspension` when available (§5.1). `requireToolApproval` remains
// the approval-gate path and must not be relabelled as a tool suspension.
// Subagent suspension is owned by the child session that actually suspended;
// parent views use the §8 / §10.6 subagent attribution rules to route the
// response to that owning session.
//
// Internally, the harness bridges to the workflow engine's suspension primitive
// after the pending record commits. That lower-level primitive may be branded
// return-value based; the harness-owned tool API still exposes the
// `Promise<never>` interrupt contract to tool authors. A response may observe
// `HarnessRecoveryDeferredError` if the pending item is committed but the
// matching workflow snapshot is not yet visible (§4.2/§5.7).
//
// `suspendTool` is always present when `HarnessRequestContext` is populated
// (harness-backed execution). Tools running outside the harness (where the
// `'harness'` slot is absent) do not have access to suspension.
interface SuspendToolParams {
  suspendData: JsonValue;
}
```
