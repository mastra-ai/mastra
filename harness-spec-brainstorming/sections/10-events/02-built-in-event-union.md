### 10.2 Built-in event union

Orientation diagram (event families only; union definitions below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-event-union-title hx-event-union-desc" viewBox="0 0 1040 440" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-event-union-title">Built-in event union families</title>
    <desc id="hx-event-union-desc">Built-in events group into lifecycle, state, turn, operation settlement, tool, subagent, suspension, attachment, channel, goal, and storage-error families.</desc>
    <defs>
      <marker id="ah-event-union" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="400" y="25" width="240" height="68" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="53" text-anchor="middle">HarnessEvent</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="75" text-anchor="middle">built-in union</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="145" width="150" height="58" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="115" y="170" text-anchor="middle">Lifecycle</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="115" y="190" text-anchor="middle">session process</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="220" y="145" width="150" height="58" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="295" y="170" text-anchor="middle">State</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="295" y="190" text-anchor="middle">mode/model/state</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="400" y="145" width="150" height="58" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="475" y="170" text-anchor="middle">Turn</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="475" y="190" text-anchor="middle">agent/text/error</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="580" y="145" width="150" height="58" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="170" text-anchor="middle">Operation</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="190" text-anchor="middle">promise boundary</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="760" y="145" width="150" height="58" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="835" y="170" text-anchor="middle">Tool</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="835" y="190" text-anchor="middle">call lifecycle</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="130" y="290" width="150" height="58" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="205" y="315" text-anchor="middle">Subagent</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="205" y="335" text-anchor="middle">parent stream</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="310" y="290" width="150" height="58" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="385" y="315" text-anchor="middle">Suspension</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="385" y="335" text-anchor="middle">pending inbox</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="490" y="290" width="150" height="58" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="565" y="315" text-anchor="middle">Attachment</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="565" y="335" text-anchor="middle">upload/delete</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="670" y="290" width="150" height="58" />
    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="745" y="315" text-anchor="middle">Channel/goal</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="745" y="335" text-anchor="middle">transport loops</text>

    <path style="stroke: #334155; stroke-width: 2.1; fill: none; marker-end: url(#ah-event-union);" d="M430 93 C300 115 170 120 120 144" />
    <path style="stroke: #334155; stroke-width: 2.1; fill: none; marker-end: url(#ah-event-union);" d="M475 93 C405 120 330 125 300 144" />
    <path style="stroke: #334155; stroke-width: 2.1; fill: none; marker-end: url(#ah-event-union);" d="M505 93 L480 144" />
    <path style="stroke: #334155; stroke-width: 2.1; fill: none; marker-end: url(#ah-event-union);" d="M550 93 C590 120 630 125 650 144" />
    <path style="stroke: #334155; stroke-width: 2.1; fill: none; marker-end: url(#ah-event-union);" d="M610 93 C710 120 800 125 830 144" />
    <path style="stroke: #334155; stroke-width: 2.1; fill: none; marker-end: url(#ah-event-union);" d="M445 93 C325 170 225 230 205 289" />
    <path style="stroke: #334155; stroke-width: 2.1; fill: none; marker-end: url(#ah-event-union);" d="M495 93 C425 175 390 235 385 289" />
    <path style="stroke: #334155; stroke-width: 2.1; fill: none; marker-end: url(#ah-event-union);" d="M545 93 C570 175 570 235 565 289" />
    <path style="stroke: #334155; stroke-width: 2.1; fill: none; marker-end: url(#ah-event-union);" d="M595 93 C690 175 740 235 745 289" />
  </svg>
  <figcaption>Only operation events settle admitted work; lifecycle and live turn events remain observability signals unless the operation family says otherwise.</figcaption>
</figure>

```ts
// Built-in failure payloads use the §13.3 public error projection. Current
// Mastra/durable-agent/plain Error causes remain implementation diagnostics and
// are not exposed on the Harness event surface.
type HarnessEventError = HarnessPublicErrorProjection;

// Lifecycle (harness-scoped; sessionId-bearing events identify the affected
// session for correlation). `session_closed` is terminal: it means `closedAt`
// was written. `session_evicted`, `session_hydrated`, and process shutdown are
// non-terminal observer notifications for cache/lease loss, rehydration, or
// process lifecycle; they are grouped here for subscriber convenience and do
// not close the durable session or add lifecycle states beyond §5.5.
type LifecycleEvent =
  | { type: 'session_created'; sessionId: string; resourceId: string; threadId: string; parentSessionId?: string }
  | { type: 'session_closing'; sessionId: string; closingAt: number; closeDeadlineAt: number }
  | { type: 'session_closed';  sessionId: string; reason: 'requested' }
  | { type: 'session_evicted'; sessionId: string }                  // dropped from live cache; record stays
  | { type: 'session_hydrated'; sessionId: string }                 // re-loaded from storage on next access
  | { type: 'harness_shutdown' };                                   // process shutdown; sessions persist

// State (session-scoped)
type StateEvent =
  // State write committed; changedKeys names top-level added/changed/removed keys.
  | { type: 'state_changed'; state: Record<string, JsonValue>; changedKeys: string[] }
  | { type: 'mode_changed';  modeId: string }
  | { type: 'model_changed'; modelId: string }
  | { type: 'token_usage_changed'; usage: TokenUsage };

// Turn (session-scoped)
type TurnEvent =
  | { type: 'agent_start';   runId: string; overrides?: PersistedRunOverrides }
  | { type: 'text_delta';    runId: string; signalId?: string; delta: string }
  | { type: 'agent_end';     runId: string; finishReason: string; usage: TokenUsage }
  // Diagnostic/run-surface error. `signalId` may attribute where the runtime
  // noticed the error, but promise settlement still uses OperationEvent below.
  | { type: 'error';         runId?: string; signalId?: string; error: HarnessEventError };

// Operation results (session-scoped). These are the promise/SDK settlement
// boundary for admitted work. They are not run lifecycle events: one run can
// answer several signal-driven messages, so `agent_end` alone never identifies
// which `message(...)` call completed. `result` is scoped to the admitted
// operation identified by `signalId` / `queuedItemId`, not to every output the
// enclosing run may have produced for other signals.
type OperationEvent =
  | { type: 'message_completed'; runId: string; signalId: string; admissionId?: string; result: AgentResult }
  | { type: 'message_failed';    runId?: string; signalId: string; admissionId?: string; error: HarnessEventError }
  | { type: 'queue_completed';   runId: string; queuedItemId: string; signalId: string; admissionId?: string; result: AgentResult }
  | { type: 'queue_failed';      runId?: string; queuedItemId: string; signalId?: string; admissionId?: string; error: HarnessEventError };

// Tool calls (session-scoped). Public event payloads are JSON-safe
// projections; raw non-JSON tool objects remain inside the owning runtime or
// app storage and do not cross the subscriber/SSE boundary.
type ToolEvent =
  | { type: 'tool_start';    runId: string; toolCallId: string; toolName: string; input: JsonValue }
  | { type: 'tool_end';      runId: string; toolCallId: string; toolName: string; output: JsonValue; isError: boolean };

// Subagent activity (session-scoped — emitted on the *parent* session's subscriber).
// `subagentSessionId` is the child session's ID and is stable across the subagent's
// lifetime. Combined with `toolCallId` (the parent-side handle), this lets a UI wire
// up the parent → child mapping at `subagent_start` and address the child session
// directly for response routing (see §10.6 and §13.2).
type SubagentEvent =
  | { type: 'subagent_start';      toolCallId: string; subagentSessionId: string; agentType: string; task: string; modelId: string; parentId?: string; depth: number }
  | { type: 'subagent_text_delta'; toolCallId: string; subagentSessionId: string; agentType: string; delta: string; parentId?: string; depth: number }
  | { type: 'subagent_tool_start'; toolCallId: string; subagentSessionId: string; agentType: string; innerToolCallId: string; toolName: string; parentId?: string; depth: number }
  | { type: 'subagent_tool_end';   toolCallId: string; subagentSessionId: string; agentType: string; innerToolCallId: string; toolName: string; output: JsonValue; isError: boolean; parentId?: string; depth: number }
  | { type: 'subagent_end';        toolCallId: string; subagentSessionId: string; agentType: string; output: JsonValue; isError: boolean; durationMs: number; parentId?: string; depth: number };

// Suspension — tool / question / plan needs user input (session-scoped).
//
// When `source: 'subagent'`, the pending item lives on the *subagent's* session
// (subagents are independent persisted sessions — see §5.6). Two extra fields are
// then required: `subagentToolCallId` (the parent-side tool-call that spawned the
// subagent) and `subagentSessionId` (the child session ID). `itemId` is the inbox
// route/action key. Clients MUST post the response to the child session's inbox:
//   POST /sessions/<subagentSessionId>/inbox/<itemId>
// Posting to the parent session's inbox returns 404 — see §13.2.
//
// When `source: 'parent'`, both subagent fields are absent.
type SuspensionEvent =
  | ({ type: 'tool_approval_required';  runId: string; itemId: string; requestedAt: number; toolCallId: string; toolName: string; toolCategory?: string; approvalReasons: ToolApprovalReasonSource[]; input: JsonValue }
      & ({ source: 'parent' } | { source: 'subagent'; subagentToolCallId: string; subagentSessionId: string }))
  | ({ type: 'tool_suspension_required'; runId: string; itemId: string; requestedAt: number; toolCallId: string; toolName: string; suspendData: JsonValue }
      & ({ source: 'parent' } | { source: 'subagent'; subagentToolCallId: string; subagentSessionId: string }))
  | ({ type: 'question_pending';        runId: string; itemId: string; requestedAt: number; toolCallId: string; question: string; options?: { label: string; description?: string }[]; selectionMode?: 'single_select' | 'multi_select' }
      & ({ source: 'parent' } | { source: 'subagent'; subagentToolCallId: string; subagentSessionId: string }))
  | ({ type: 'plan_approval_required';  runId: string; itemId: string; requestedAt: number; toolCallId: string; title: string; plan: string }
      & ({ source: 'parent' } | { source: 'subagent'; subagentToolCallId: string; subagentSessionId: string }));

// Client SDKs project these live notifications into the §13.4
// `PendingInboxItem` view model. This event union remains the authoritative live
// notification shape; the projection must not redefine pending-item payloads.
// A goal judge question auto-answer (§4.7) does not introduce a separate
// `goal_*` or `question_answered` event. It consumes the same pending item
// through the normal inbox response transition; clients observe the updated
// display/snapshot state, `InboxResponseResult`, and any channel
// `inbox-resolution` projection from the durable receipt.

// Attachments (session-scoped)
type AttachmentEvent =
  | { type: 'attachment_uploaded'; attachmentId: string; name: string; mimeType: string; bytes: number }
  | { type: 'attachment_deleted';  attachmentId: string };

// Harness v1 does not define a generic workspace file mutation event. Provider
// filesystem audit, if present, remains provider-owned inspection data; tools
// may emit custom progress events, but those events do not become memory/OM
// inputs or durable recovery proof by themselves (§2.7).

// Channels (session-scoped when a binding/session is known; harness-scoped
// for malformed or unbound inbound payloads). These events are best-effort
// projections of Channel* ledger rows, not the durable recovery/dispatch
// substrate.
type ChannelEvent =
  | { type: 'channel_ingress_received'; harnessName: string; channelId: string; inboxItemId: string; externalMessageId: string; bindingId?: string }
  | { type: 'channel_ingress_admitted'; harnessName: string; channelId: string; inboxItemId: string; bindingId: string; delivery: 'message' | 'queue'; runId?: string; signalId?: string; queuedItemId?: string }
  | { type: 'channel_ingress_failed'; harnessName: string; channelId: string; inboxItemId?: string; externalMessageId?: string; error: HarnessEventError }
  | { type: 'channel_outbox_enqueued'; harnessName: string; channelId: string; outboxItemId: string; bindingId: string; kind: ChannelOutboxItem['kind'] }
  | { type: 'channel_outbox_sent'; harnessName: string; channelId: string; outboxItemId: string; bindingId: string; providerMessageId?: string }
  | { type: 'channel_outbox_failed'; harnessName: string; channelId: string; outboxItemId: string; bindingId: string; attempts: number; dead: boolean; error: HarnessEventError }
  | { type: 'channel_action_received'; harnessName: string; channelId: string; actionReceiptId: string; actionTokenId: string; actionId: string; itemId: string }
  | { type: 'channel_action_accepted'; harnessName: string; channelId: string; actionReceiptId: string; actionTokenId: string; actionId: string; itemId: string; responseId: string }
  | { type: 'channel_action_applied'; harnessName: string; channelId: string; actionReceiptId: string; actionTokenId: string; actionId: string; itemId: string }
  | { type: 'channel_action_conflict'; harnessName: string; channelId: string; actionReceiptId: string; actionTokenId: string; actionId: string; itemId: string; conflictReason?: ChannelActionReceipt['conflictReason'] }
  | { type: 'channel_action_failed'; harnessName: string; channelId: string; actionReceiptId?: string; actionTokenId?: string; actionId?: string; itemId?: string; error: HarnessEventError };

// Goals (session-scoped). See §4.7.
type GoalEvent =
  | { type: 'goal_set';      goal: GoalState }
  | { type: 'goal_judged';   goalId: string; decision: GoalJudgeDecision; turnsUsed: number; maxTurns: number }
  | { type: 'goal_done';     goalId: string; reason: string; turnsUsed: number }
  | { type: 'goal_waiting';  goalId: string; reason: string; turnsUsed: number }
  | { type: 'goal_paused';   goalId: string; reason: 'requested' | 'budget_exhausted' | 'judge_failed' }
  | { type: 'goal_resumed';  goalId: string }
  | { type: 'goal_cleared';  goalId: string };

// Storage failures (session-scoped or harness-scoped depending on origin).
// `operation` and `subject` use the same taxonomy as `HarnessStorageError`.
type StorageErrorEvent =
  | {
      type: 'storage_error';
      operation: HarnessStorageOperation;
      retryable: boolean;
      error: Extract<HarnessEventError, { code: 'harness.storage' }>;
      sessionId?: string;
      resourceId?: string;
      threadId?: string;
      harnessName?: string;
      channelId?: string;
      subject?: HarnessStorageSubject;
    };

// Tool-emitted custom events. Tool authors provide only `type` and optional
// `payload`; the harness fills event identity and, for parent-surfaced subagent
// copies, the attribution fields from §10.6.
type CustomEventType = `${string}.${string}`;
type CustomEvent = {
  type: CustomEventType;
  sessionId: string;
  resourceId: string;
  threadId: string;
  payload?: JsonValue;
} & (
  | { source?: 'parent' }
  | { source: 'subagent'; subagentToolCallId: string; subagentSessionId: string }
);
```

`display_state_changed` is not a v1 built-in event and does not travel over the
session SSE route. Implementations may keep private non-`HarnessEvent`
notifications or an internal scheduler behind `subscribeDisplayState(...)`, but
they must not emit `display_state_changed` through public `session.subscribe(...)`,
`harness.subscribe(...)`, or session SSE `HarnessEvent` surfaces. The portable
display-state contract is `session.getDisplayState()` /
`subscribeDisplayState(...)` returning `HarnessDisplayStateSnapshotV1` (§4.2,
§5.1). Remote clients recover display state after reconnect by refetching
`GET /sessions/:sessionId`, not by replaying synthetic display-snapshot events.

The set is closed for built-in types (anything in the union above is harness-owned). Tools emit custom types only — see §10.3.
