# Harness

The Harness is the core orchestration layer for building interactive agent UIs. It manages multiple agent modes, shared state, conversation threads, tool permissions, subagents, observational memory, and workspace integration — all behind an event-driven interface that a TUI (or any UI) can subscribe to.

## Quick Start

```ts
import { Harness } from '@mastra/core/harness';
import { z } from 'zod';

const harness = new Harness({
  id: 'my-coding-agent',
  storage: new LibSQLStore({ url: 'file:./data.db' }),
  stateSchema: z.object({
    currentModelId: z.string().optional(),
  }),
  modes: [
    { id: 'plan', name: 'Plan', default: true, agent: planAgent, defaultModelId: 'anthropic/claude-sonnet-4' },
    { id: 'build', name: 'Build', agent: buildAgent, defaultModelId: 'anthropic/claude-sonnet-4' },
  ],
});

// Subscribe to events
harness.subscribe(event => {
  if (event.type === 'message_update') renderMessage(event.message);
});

// Initialize (loads storage, workspace, starts heartbeats)
await harness.init();

// Select or create a thread
await harness.selectOrCreateThread();

// Send a message
await harness.sendMessage('Hello!');
```

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                    Harness                       │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Mode:Plan│  │Mode:Build│  │ Mode:... │       │
│  │  Agent A │  │  Agent B │  │  Agent C │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │              Shared State               │     │
│  │  (Zod-validated, currentModelId, etc.)  │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  ┌───────────┐ ┌────────────┐ ┌────────────┐    │
│  │  Threads  │ │Permissions │ │ Subagents  │    │
│  │ (Storage) │ │  (Layered) │ │ (Delegated)│    │
│  └───────────┘ └────────────┘ └────────────┘    │
│                                                  │
│  ┌───────────┐ ┌────────────┐ ┌────────────┐    │
│  │ Workspace │ │ Obs Memory │ │ Heartbeats │    │
│  │ (Sandbox) │ │   (OM)     │ │ (Periodic) │    │
│  └───────────┘ └────────────┘ └────────────┘    │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │           Event System                  │     │
│  │  subscribe() → HarnessEvent stream     │     │
│  └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Modes & Agent Orchestration

Modes wrap distinct `Agent` instances. The harness supports switching between them at runtime, with each mode independently tracking its preferred model.

```ts
modes: [
  { id: 'plan', name: 'Plan', default: true, agent: planAgent, defaultModelId: 'anthropic/claude-sonnet-4' },
  { id: 'build', name: 'Build', agent: buildAgent, defaultModelId: 'anthropic/claude-sonnet-4' },
];
```

**switchMode(modeId)**:

1. Aborts any in-progress generation
2. Saves the current model to thread metadata (keyed as `modeModelId_<currentModeId>`)
3. Loads the incoming mode's stored model (thread metadata → mode default → null)
4. Emits `mode_changed`

The `agent` field can also be a function `(state) => Agent`, enabling state-dependent agent selection.

During `init()`, the harness propagates shared `memory` and `workspace` to all mode agents that don't already have their own.

### 2. Subagent System

Subagents let the main agent delegate focused tasks to specialized child agents that run in isolation with constrained toolsets.

```ts
subagents: [
  {
    id: 'explore',
    name: 'Explore',
    description: 'Read-only codebase exploration',
    instructions: 'You are a code exploration agent...',
    tools: { grep: grepTool, view: viewTool },
    allowedHarnessTools: ['read_file'],
    defaultModelId: 'anthropic/claude-sonnet-4',
  },
];
```

The harness auto-creates a `subagent` tool when `config.subagents` is defined. The model resolution chain is:

1. Explicit `modelId` argument on the tool call
2. `harness.getSubagentModelId(agentType)` (per-type state)
3. Subagent definition's `defaultModelId`
4. Current mode's `defaultModelId`

Results include a `<subagent-meta>` tag with `modelId`, `durationMs`, and `toolCalls` for audit. Use `parseSubagentMeta()` to extract this from tool result strings.

### 3. Permission & Tool Approval

A layered authorization system controls which tools execute automatically vs. require user approval.

**Categories**: `'read' | 'edit' | 'execute' | 'mcp' | 'other'`
**Policies**: `'allow' | 'ask' | 'deny'`

**Resolution chain** (in order of precedence):

1. **Yolo mode** — `state.yolo === true` → allow everything
2. **Per-tool policy** — `rules.tools[toolName]`
3. **Session tool grant** — `grantSessionTool(name)` (in-memory, not persisted)
4. **Session category grant** — `grantSessionCategory(category)`
5. **Category policy** — `rules.categories[category]`
6. **Default** — `'ask'`

When the stream yields a `tool-call-approval` chunk:

- `'allow'` → auto-approves via `agent.approveToolCall()`
- `'deny'` → auto-declines via `agent.declineToolCall()`
- `'ask'` → emits `tool_approval_required`, awaits `resolveToolApprovalDecision()`

The UI can respond with `'approve'`, `'decline'`, or `'always_allow_category'` (grants the category for the rest of the session).

### 4. Observational Memory (OM)

OM is a background system that observes, summarizes, and reflects on conversation history to manage context window limits.

```ts
omConfig: {
  defaultObserverModelId: 'anthropic/claude-haiku-3',
  defaultReflectorModelId: 'anthropic/claude-sonnet-4',
  defaultObservationThreshold: 30_000,   // tokens before observation triggers
  defaultReflectionThreshold: 40_000,    // observation tokens before reflection triggers
}
```

**Lifecycle**:

- Messages accumulate tokens in the active window
- When `observationThreshold` is hit → **observation** runs (summarizes messages into observations)
- Observation tokens accumulate
- When `reflectionThreshold` is hit → **reflection** runs (compresses observations)
- **Buffering** stages content before activation
- **Activation** moves buffered content into the active window

All OM operations happen transparently during agent streaming. The harness intercepts custom stream chunks (`data-om-*`) and emits corresponding events:

| Stream Chunk                 | Harness Event                                    |
| ---------------------------- | ------------------------------------------------ |
| `data-om-status`             | `om_status`                                      |
| `data-om-observation-start`  | `om_observation_start` / `om_reflection_start`   |
| `data-om-observation-end`    | `om_observation_end` / `om_reflection_end`       |
| `data-om-observation-failed` | `om_observation_failed` / `om_reflection_failed` |
| `data-om-buffering-start`    | `om_buffering_start`                             |
| `data-om-buffering-end`      | `om_buffering_end`                               |
| `data-om-buffering-failed`   | `om_buffering_failed`                            |
| `data-om-activation`         | `om_activation`                                  |

`loadOMProgress()` restores OM status when switching threads by scanning stored messages for the most recent `data-om-status` part.

### 5. Task Tracking

The harness includes a built-in task tracking system with two tools (`task_write` and `task_check`) that are automatically injected into every agent's toolset.

**`task_write`** replaces the entire task list (full-replacement semantics). Each task has:

- `content` — imperative description of the task
- `status` — `'pending' | 'in_progress' | 'completed'`
- `activeForm` — present continuous description shown during execution

```ts
// The agent calls task_write with the full task list:
{
  tasks: [
    { content: 'Add validation', status: 'completed', activeForm: 'Adding validation' },
    { content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
    { content: 'Update docs', status: 'pending', activeForm: 'Updating docs' },
  ];
}
```

**`task_check`** reads the current task list and returns completion statistics (total, completed, in progress, pending, list of incomplete tasks, `allDone` boolean).

Tasks are stored in harness state under the `tasks` key. The harness emits a `task_updated` event whenever the list changes, and provides a `getTasks()` convenience method.

### 6. Thread & State Management

**State** is a Zod-validated in-memory object. The harness merges schema defaults with `initialState` on construction. `setState()` validates via `safeParse()` and emits `state_changed` with the list of changed keys.

**Threads** are conversation containers scoped by `resourceId`:

| Method                   | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `createThread(title?)`   | Creates a new thread, persists to storage, resets token usage   |
| `switchThread(threadId)` | Aborts current run, loads thread metadata (mode, model, tokens) |
| `listThreads()`          | Lists threads for the current `resourceId`                      |
| `selectOrCreateThread()` | Picks the most recent thread or creates one                     |
| `renameThread(title)`    | Updates the thread title in storage                             |

Thread metadata stores per-thread settings: current mode, per-mode model IDs, token usage, and any custom values via `persistThreadSetting(key, value)`.

### 7. Message Processing & Execution Control

**sendMessage(content, options?)**:

1. Auto-creates a thread if none exists
2. Builds request context and toolsets (including `ask_user`, `submit_plan`, `task_write`, `task_check`, and optionally `subagent`)
3. Calls `agent.stream()` with `maxSteps: 1000`
4. Consumes the stream via `processStream()`, emitting events for each chunk
5. On "tool not found" errors, auto-queues a correction follow-up
6. After completion, drains the follow-up queue

**Execution control**:

| Method              | Behavior                                              |
| ------------------- | ----------------------------------------------------- |
| `abort()`           | Signals the AbortController, stops current generation |
| `steer(content)`    | Aborts + clears follow-up queue + sends new message   |
| `followUp(content)` | Queues if running, sends immediately if idle          |

**Question & Plan approval**: `ask_user` and `submit_plan` tools pause execution by registering a Promise resolver. The UI calls `respondToQuestion()` or `respondToPlanApproval()` to resume. Plan approval auto-switches to the default mode on acceptance.

### 8. Workspace Integration

The workspace provides a sandboxed environment (filesystem, command execution) for tools.

Three initialization modes:

| Config Value                  | Behavior                                                  |
| ----------------------------- | --------------------------------------------------------- |
| `Workspace` instance          | Used directly                                             |
| `(ctx) => Workspace` function | Resolved per-request (useful for multi-tenant/serverless) |
| `WorkspaceConfig` object      | Constructed during `init()`                               |

During `init()`, the workspace is propagated to all mode agents. Tools access it via `requestContext.get('harness').workspace`.

Lifecycle events: `workspace_status_changed` (`initializing` → `ready` / `error` / `destroying` → `destroyed`), `workspace_ready`, `workspace_error`.

### 9. Heartbeat System

Heartbeats are periodic background tasks.

```ts
heartbeatHandlers: [
  {
    id: 'health-check',
    intervalMs: 30_000,
    immediate: true, // run immediately on registration (default)
    handler: async () => {
      /* periodic work */
    },
    shutdown: async () => {
      /* cleanup */
    },
  },
];
```

- Started at the end of `init()` via `startHeartbeats()`
- Timers use `.unref()` so they don't keep the process alive
- `registerHeartbeat()` adds handlers dynamically after init
- `removeHeartbeat(id)` stops a specific handler and calls its `shutdown()`
- `stopHeartbeats()` stops all handlers

## Event System

Subscribe to all harness events with a single listener:

```ts
const unsubscribe = harness.subscribe(event => {
  switch (event.type) {
    case 'mode_changed': // { modeId, previousModeId }
    case 'model_changed': // { modelId, scope?, modeId? }
    case 'state_changed': // { state, changedKeys }
    case 'thread_created': // { thread }
    case 'thread_changed': // { threadId, previousThreadId }
    case 'agent_start': // {}
    case 'agent_end': // { reason: 'complete' | 'aborted' | 'error' }
    case 'message_start': // { message }
    case 'message_update': // { message }
    case 'message_end': // { message }
    case 'tool_start': // { toolCallId, toolName, args }
    case 'tool_approval_required': // { toolCallId, toolName, args }
    case 'tool_end': // { toolCallId, result, isError }
    case 'usage_update': // { usage: { promptTokens, completionTokens, totalTokens } }
    case 'error': // { error, retryable? }
    case 'ask_question': // { questionId, question, options? }
    case 'plan_approval_required': // { planId, title?, plan }
    case 'task_updated': // { tasks: TaskItem[] }
    case 'subagent_start': // { agentType, task }
    case 'subagent_end': // { agentType, durationMs }
    case 'om_status': // { windows, recordId, threadId, stepNumber, generationCount }
    case 'om_observation_start':
    case 'om_observation_end':
    case 'om_observation_failed':
    case 'om_reflection_start':
    case 'om_reflection_end':
    case 'om_reflection_failed':
    case 'om_buffering_start':
    case 'om_buffering_end':
    case 'om_buffering_failed':
    case 'om_activation':
    case 'workspace_status_changed':
    case 'workspace_ready':
    case 'workspace_error':
    case 'follow_up_queued': // { count }
  }
});

// Later: unsubscribe()
```

## Built-in Tools

Five tools are automatically injected into every agent's toolset (some conditionally):

| Tool          | Purpose                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ask_user`    | Asks the user a question (optionally with structured choices). Pauses execution until the UI responds via `respondToQuestion()`.        |
| `submit_plan` | Submits a markdown plan for user review. Pauses until `respondToPlanApproval()`. On approval, auto-switches to the default mode.        |
| `task_write`  | Creates or replaces the task list. Stores tasks in harness state and emits `task_updated`.                                              |
| `task_check`  | Returns task completion statistics. Useful before finishing multi-step work.                                                            |
| `subagent`    | Delegates a task to a specialized subagent (only present when `config.subagents` is defined). Runs in isolation with constrained tools. |

## Exported API

```ts
// Class
export { Harness } from './harness';

// Built-in tools & utilities
export { askUserTool, submitPlanTool, taskWriteTool, taskCheckTool, parseSubagentMeta } from './tools';

// Types
export type {
  AvailableModel,
  HarnessConfig,
  HarnessEvent,
  HarnessEventListener,
  HarnessMessage,
  HarnessMessageContent,
  HarnessMode,
  HarnessOMConfig,
  HarnessRequestContext,
  HarnessSession,
  HarnessStateSchema,
  HarnessSubagent,
  HarnessThread,
  HeartbeatHandler,
  ModelAuthChecker,
  ModelAuthStatus,
  ModelUseCountProvider,
  PermissionPolicy,
  PermissionRules,
  TaskItem,
  ToolCategory,
  TokenUsage,
} from './types';
```

## File Structure

```
harness/
├── harness.ts   # Harness class — orchestration, state, threads, streaming, events
├── tools.ts     # Built-in tools: ask_user, submit_plan, task_write, task_check, subagent, parseSubagentMeta
├── types.ts     # All type definitions (config, events, modes, permissions, etc.)
└── index.ts     # Public exports
```
