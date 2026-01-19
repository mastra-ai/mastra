# Task 18: Task → Run Association

## Summary

Associate task execution with agent runs for observability and streaming.

## Files to Modify

- `packages/core/src/inbox/types.ts` - Add runId to Task
- `packages/core/src/agent/agent.ts` - Link run to task in processTask()

## Changes

### 1. Update Task Interface

```typescript
// packages/core/src/inbox/types.ts

interface Task<TPayload = unknown, TResult = unknown> {
  // ... existing fields

  // Run association
  runId?: string; // ID of the agent run processing this task
}
```

### 2. Update Storage Schema

```typescript
// packages/core/src/inbox/constants.ts

const INBOX_TASKS_SCHEMA = {
  // ... existing fields
  run_id: { type: 'text', nullable: true },
};
```

### 3. Update processTask in Agent

```typescript
// packages/core/src/agent/agent.ts

async #processTask(
  task: Task,
  inbox: Inbox,
  options: AgentRunOptions
): Promise<void> {
  options.onTaskStart?.(task);

  try {
    // Mark as in progress
    await inbox.startTask(task.id);

    // Generate with run tracking
    const result = await this.stream({
      messages: [
        {
          role: 'user',
          content: typeof task.payload === 'string'
            ? task.payload
            : JSON.stringify(task.payload),
        },
      ],
      threadId: task.metadata?.threadId as string,
      resourceId: task.metadata?.resourceId as string,
      runId: task.id,  // Use task ID as run ID for correlation
      onFinish: async (run) => {
        // Update task with run ID
        await inbox.updateTask(task.id, { runId: run.runId });
      },
    });

    // Collect result
    const output = {
      text: result.text,
      usage: result.usage,
    };

    // Complete
    await inbox.complete(task.id, output);
    await inbox.onComplete?.(task, output);
    options.onTaskComplete?.(task, output);

  } catch (error) {
    // ... error handling
  }
}
```

### 4. Add updateTask to InboxStorage

```typescript
// packages/core/src/inbox/inbox-storage.ts

abstract class InboxStorage extends StorageDomain {
  // ... existing methods

  abstract updateTask(taskId: string, updates: Partial<Pick<Task, 'runId' | 'metadata'>>): Promise<Task>;
}
```

### 5. Add updateTask to Inbox

```typescript
// packages/core/src/inbox/inbox.ts

class Inbox {
  async updateTask(taskId: string, updates: Partial<Pick<Task, 'runId' | 'metadata'>>): Promise<Task> {
    const storage = this.getStorage();
    return storage.updateTask(taskId, updates);
  }
}
```

## Observability Benefits

With runId on task:

- UI can link to run details
- Stream run output in real-time
- Trace task → run → LLM calls
- Debug failed tasks by viewing run

## Acceptance Criteria

- [ ] Task interface has runId field
- [ ] Storage schema includes run_id column
- [ ] processTask links run to task
- [ ] updateTask method available on Inbox
- [ ] Can query tasks by runId
