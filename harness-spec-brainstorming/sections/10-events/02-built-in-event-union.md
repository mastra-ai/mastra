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
