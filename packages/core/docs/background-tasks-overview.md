# Background Tasks: Improving the Agentic Loop

## What Are Background Tasks?

Background tasks allow an agent to offload tool call execution, sub-agent invocations, or workflow runs to a background process while the main conversation continues. Instead of the agent blocking on every tool call and waiting for the result before responding, it can acknowledge the task, continue interacting with the user, and incorporate results when they arrive.

## The Current Agentic Loop (Blocking Model)

Today, the Mastra agent loop is fully synchronous and blocking. Here is the flow:

```
User Message
    ↓
LLM Call (decides: text response or tool calls)
    ↓
┌─── If tool calls ───────────────────────────────┐
│  Execute ALL tool calls (await each result)      │
│  Add tool results to message list                │
│  Loop back to LLM Call                           │
└──────────────────────────────────────────────────┘
    ↓
LLM produces final text response
    ↓
Return to user
```

### Where Blocking Happens

1. **Tool Execution Step** (`tool-call-step.ts`): Each tool call runs via `await tool.execute(args, options)`. The entire agentic loop pauses until every tool in the current iteration completes.

2. **Sub-Agent Execution** (`agent.ts` — `listAgentTools()`): Sub-agents are wrapped as tools. When the parent agent delegates to a sub-agent, it calls `await agent.generate()` or pipes `agent.stream()` — both block the parent's loop until the sub-agent finishes its own complete agentic loop.

3. **Workflow Execution**: Workflows invoked as tools similarly block until the workflow run completes.

4. **Agentic Execution Workflow** (`agentic-execution/index.ts`): The workflow structure is:
   ```
   llmExecutionStep → toolCallStep (foreach) → llmMappingStep → isTaskCompleteStep
   ```
   The `foreach` over tool calls is the blocking bottleneck. Nothing proceeds until all tool calls in the current step resolve.

### Concurrency Within a Step (Not Between Steps)

The current implementation does support concurrent tool execution _within a single step_ — up to `toolCallConcurrency` (default 10) tool calls run in parallel. But this is concurrency within the blocking boundary: the loop still waits for all of them before moving on. The conversation cannot continue during this wait.

## How Background Tasks Improve the Loop

### The Core Problem

Many tool calls, sub-agent runs, and workflows take significant time (API calls, data processing, search operations). During this time:

- The user sees no response and cannot interact
- The agent cannot handle follow-up questions
- The agent cannot start other work that doesn't depend on the pending result
- Long-running sub-agents compound the problem (a sub-agent may itself run multiple tool calls)

### The Background Task Model

```
User Message
    ↓
LLM Call (decides: text response, tool calls, or background tasks)
    ↓
┌─── If background task ──────────────────────────┐
│  Dispatch tool/agent/workflow to background       │
│  Return acknowledgment to LLM immediately         │
│  LLM continues generating response to user        │
└──────────────────────────────────────────────────┘
    ↓
User continues conversation
    ↓
┌─── When background task completes ──────────────┐
│  Result injected into conversation context        │
│  Agent notified / user notified                   │
│  Agent can act on result in next turn              │
└──────────────────────────────────────────────────┘
```

### What Changes

| Aspect          | Current (Blocking)                    | With Background Tasks                          |
| --------------- | ------------------------------------- | ---------------------------------------------- |
| Tool execution  | Agent waits for every tool result     | Agent can dispatch to background and continue  |
| Sub-agent calls | Parent blocked until child finishes   | Parent continues, child reports back when done |
| User experience | No interaction during tool execution  | Conversation flows naturally during long tasks |
| Parallel work   | Only concurrent tools within one step | Multiple independent tasks across steps        |
| Error handling  | Inline — errors block the loop        | Background errors reported asynchronously      |

### Concrete Scenarios

**Scenario 1: Research Agent**
A user asks an agent to research three different topics. Today, the agent calls three tools sequentially (or concurrently within one step) and the user waits. With background tasks, the agent dispatches all three as background tasks, tells the user "I'm looking into those now," and can answer follow-up questions while research runs.

**Scenario 2: Sub-Agent Delegation**
An orchestrator agent delegates to three specialist sub-agents. Today, each sub-agent blocks the parent. With background tasks, all three run in parallel in the background. The orchestrator can update the user on progress and synthesize results as they arrive.

**Scenario 3: Long-Running Workflow**
A deployment workflow takes minutes. Today, the conversation is frozen. With background tasks, the agent dispatches the workflow, continues chatting, and notifies the user when deployment completes.

### Integration Points in the Current Architecture

The existing architecture has natural extension points for background tasks:

1. **Tool Call Step**: The `tool-call-step.ts` foreach loop is the primary injection point. Instead of `await tool.execute()`, a background-eligible tool call would dispatch and return a placeholder result immediately.

2. **Message List**: The message list abstraction already handles incremental updates. Background task results can be appended as they complete, similar to how tool results are added today.

3. **Suspension/Resume**: The existing suspend/resume mechanism (used for tool approval and workflow suspension) provides a pattern for pausing and resuming around background task completion. Background tasks could leverage similar state serialization.

4. **Stream Chunks**: The streaming infrastructure already emits typed chunks (`tool-call`, `tool-result`, `text-delta`). New chunk types (`background-task-started`, `background-task-completed`) fit naturally.

5. **Agent-as-Tool**: Sub-agents already have their own thread/resource IDs and memory isolation. Running them in the background is conceptually straightforward — they already operate independently.

6. **Output Writer**: Tools already receive an `outputWriter` for streaming intermediate output. This same channel could relay background task progress.

### Key Design Questions

- **Agent awareness**: How does the LLM know which tools can run in the background? Is this part of the tool description, a system prompt addition, or a separate mechanism?
- **Result delivery**: When a background task completes, does the result get injected into the next user turn, or does it interrupt the current generation?
- **Task lifecycle**: Can background tasks be cancelled? Can they be queried for status?
- **Ordering guarantees**: If multiple background tasks complete, in what order are their results processed?
- **Memory persistence**: How are background task results saved to thread memory?
- **Error handling**: How are background task failures surfaced to the agent and user?
