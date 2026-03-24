# Background Tasks: Loop Integration Plan

## Problem

Currently, the agentic loop ends before background tasks complete. The LLM never sees the real results — it only gets a placeholder. The result is injected into the message list after the stream closes, which is useless unless the user sends another message.

```
Current flow:
  Iteration 1:
    LLM calls crypto-research (background) + crypto-price (foreground)
    → crypto-research: placeholder returned
    → crypto-price: real result returned
    → LLM: "I'm researching Solana. Bitcoin is at $68k."
    → isTaskComplete: no tool calls pending → isContinued = false
    → Loop ends, stream closes ❌
    → Background task completes later → result goes nowhere
```

## Solution

Keep the agentic loop running while background tasks are pending. When a task completes, feed the real result back and let the LLM iterate again. Use Strategy B (process as they arrive) for the best UX — the user sees partial results as each background task finishes.

```
Proposed flow:
  Iteration 1:
    LLM calls crypto-research (background) + crypto-price (foreground)
    → crypto-research: placeholder returned, task ID tracked
    → crypto-price: real result returned
    → LLM: "I'm researching Solana. Bitcoin is at $68k."
    → isTaskComplete: pending background tasks? YES
      → skip scorers (LLM hasn't processed everything yet)
      → wait for NEXT task to complete (whichever finishes first)
      → inject real result into message list
      → isContinued = true

  Iteration 2:
    → LLM sees the real crypto-research result
    → LLM: "Here's what I found about Solana: market cap $82B, up 12%..."
    → isTaskComplete: pending background tasks? NO → run scorers normally
      → scorers pass → isContinued = false
    → Loop ends, stream closes ✅
```

## Strategy B: Process As They Arrive (Multiple Tasks)

When multiple background tasks are dispatched, we don't wait for all of them. We wait for whichever finishes next, inject that one result, and let the LLM iterate. This repeats until all tasks are done.

```
Multiple tasks flow:
  Iteration 1:
    LLM calls research-A (bg) + research-B (bg) + price-C (fg)
    → A: placeholder, B: placeholder, C: real result
    → LLM: "Researching A and B. C is at $2.50."
    → isTaskComplete: 2 pending tasks
      → wait for NEXT to complete (A finishes first)
      → inject A's result
      → isContinued = true

  Iteration 2:
    → LLM sees A's real result
    → LLM: "Here's what I found about A: ..."
    → isTaskComplete: 1 pending task (B)
      → skip scorers
      → wait for B to complete
      → inject B's result
      → isContinued = true

  Iteration 3:
    → LLM sees B's real result
    → LLM: "And here's B: ..."
    → isTaskComplete: 0 pending tasks → run scorers
      → scorers pass → isContinued = false
    → Loop ends ✅
```

The user sees three streamed responses interleaved, which is great UX — they get incremental results instead of waiting for everything.

## Implementation

### 1. Track Pending Background Tasks

**File:** `loop/types.ts`

Add to `StreamInternal`:

```typescript
// Set of background task IDs that have been dispatched but not yet completed
pendingBackgroundTasks?: Set<string>;
```

**File:** `tool-call-step.ts`

After dispatching a background task, record it:

```typescript
if (!_internal.pendingBackgroundTasks) {
  _internal.pendingBackgroundTasks = new Set();
}
_internal.pendingBackgroundTasks.add(task.id);
```

**File:** `loop/loop.ts`

Pass through in `internalToUse`:

```typescript
pendingBackgroundTasks: _internal?.pendingBackgroundTasks,
```

### 2. Add `waitForNextTask` to BackgroundTaskManager

**File:** `background-tasks/manager.ts`

Add a method that returns a promise that resolves when the next task from a given set completes:

```typescript
async waitForNextTask(taskIds: Set<string>, timeoutMs?: number): Promise<BackgroundTask> {
  // Check if any are already done
  for (const id of taskIds) {
    const task = this.tasks.get(id);
    if (task && (task.status === 'completed' || task.status === 'failed' ||
                 task.status === 'cancelled' || task.status === 'timed_out')) {
      return task;
    }
  }

  // Wait for the next one to complete
  return new Promise((resolve, reject) => {
    const timeout = timeoutMs
      ? setTimeout(() => reject(new Error('Timed out waiting for background task')), timeoutMs)
      : undefined;

    const checkInterval = setInterval(() => {
      for (const id of taskIds) {
        const task = this.tasks.get(id);
        if (task && (task.status === 'completed' || task.status === 'failed' ||
                     task.status === 'cancelled' || task.status === 'timed_out')) {
          clearInterval(checkInterval);
          if (timeout) clearTimeout(timeout);
          resolve(task);
          return;
        }
      }
    }, 50);
  });
}
```

### 3. Modify isTaskCompleteStep

**File:** `loop/workflows/agentic-execution/is-task-complete-step.ts`

This is the core change. Before the scorer call, check for pending background tasks. If any are pending:

1. Wait for the next one to complete
2. Inject the real result into the message list
3. Remove it from the pending set
4. Skip scorers (LLM hasn't processed the result yet)
5. Set `isContinued = true` to force another loop iteration

```typescript
execute: async ({ inputData }) => {
  currentIteration++;

  // --- Background task completion check (BEFORE scorers) ---
  const pendingBgTasks = _internal?.pendingBackgroundTasks;
  const bgManager = _internal?.backgroundTaskManager;

  if (pendingBgTasks && pendingBgTasks.size > 0 && bgManager) {
    // Wait for the NEXT task to complete (Strategy B — process as they arrive)
    const completedTask = await bgManager.waitForNextTask(pendingBgTasks);

    // Remove from pending set
    pendingBgTasks.delete(completedTask.id);

    // Inject the real result into the message list
    const resultContent =
      completedTask.status === 'completed'
        ? typeof completedTask.result === 'string'
          ? completedTask.result
          : JSON.stringify(completedTask.result ?? '')
        : `Background task failed: ${completedTask.error?.message ?? 'Unknown error'}`;

    messageList.add(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: completedTask.toolCallId,
              toolName: completedTask.toolName,
              result: resultContent,
            },
          ],
        },
      ],
      'response',
    );

    // Emit background-task-completed chunk
    controller.enqueue({
      type: 'background-task-completed',
      runId,
      from: ChunkFrom.AGENT,
      payload: {
        taskId: completedTask.id,
        toolName: completedTask.toolName,
        toolCallId: completedTask.toolCallId,
        result: completedTask.result,
      },
    });

    // Skip scorers — LLM hasn't processed this result yet
    // Force the loop to continue so the LLM can see and respond to it
    if (inputData.stepResult) {
      inputData.stepResult.isContinued = true;
    }

    return inputData;
  }

  // --- Normal scorer path (only when no pending background tasks) ---
  const hasIsTaskCompleteScorers = isTaskComplete?.scorers && isTaskComplete.scorers.length > 0;

  if (!hasIsTaskCompleteScorers || inputData.stepResult?.isContinued) {
    return inputData;
  }

  // ... existing scorer logic unchanged ...
};
```

### 4. What Gets Removed

The current result injection in `tool-call-step.ts` (the `setResultInjector` call) becomes unnecessary for the primary flow — the `isTaskCompleteStep` handles injection. The injector can remain as a fallback for edge cases (e.g., task completes after the loop has already ended for other reasons).

The `setStreamChunkEmitter` for completion chunks also moves to `isTaskCompleteStep` since that's where we know the task is done and can emit the chunk in the right stream context.

### 5. Edge Cases

**Task completes before isTaskComplete runs:**
No problem — `waitForNextTask` checks already-completed tasks first.

**Task fails:**
Same flow — inject the error as a tool-result, LLM processes it ("The research failed because...").

**Timeout:**
If `waitForNextTask` times out, mark the task as timed_out, inject an error result, continue.

**maxSteps limit reached:**
The dowhile's `stopWhen` / `maxSteps` check still applies. If maxSteps is hit while background tasks are pending, the loop stops and remaining tasks become "orphaned" — their results go into the message list for the next user turn (existing behavior as fallback).

**LLM dispatches more background tasks while processing a completed one:**
Works naturally — iteration 2 might dispatch new background tasks, which get added to `pendingBackgroundTasks`. The next isTaskComplete check will wait for them too.

### 6. Files Changed

| File                                         | Change                                                         |
| -------------------------------------------- | -------------------------------------------------------------- |
| `loop/types.ts`                              | Add `pendingBackgroundTasks?: Set<string>` to `StreamInternal` |
| `loop/loop.ts`                               | Pass through `pendingBackgroundTasks` in `internalToUse`       |
| `background-tasks/manager.ts`                | Add `waitForNextTask(taskIds, timeoutMs)` method               |
| `agentic-execution/is-task-complete-step.ts` | Add background task wait + inject before scorer call           |
| `agentic-execution/tool-call-step.ts`        | Record task IDs in `_internal.pendingBackgroundTasks`          |

### 7. Stream Chunk Timeline (User Experience)

```
[start]
[step-start]
[tool-call] crypto-research (Solana)
[background-task-started] { taskId: "abc" }
[tool-result] placeholder for crypto-research
[tool-call] crypto-price (Bitcoin)
[tool-result] { prices: [{ id: "bitcoin", priceUsd: 68434 }] }
[text-delta] "I'm looking into Solana for you. Meanwhile, Bitcoin is at $68,434..."
[step-finish] (iteration 1)
  ← isTaskComplete waits for background task
  ← Solana research completes
[background-task-completed] { taskId: "abc", result: { name: "Solana", ... } }
[step-start] (iteration 2)
[text-delta] "Here's what I found about Solana: market cap rank #5, ..."
[step-finish] (iteration 2)
  ← isTaskComplete: no pending tasks → run scorers → complete
[finish]
```
