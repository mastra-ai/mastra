# Task 20: Human-in-the-Loop Support

## Summary

Allow task execution to pause and wait for human input, then continue.

## Concept

Tasks can enter a `waiting_for_input` state when the agent needs human approval or additional information.

```
pending → claimed → in_progress → waiting_for_input → in_progress → completed
```

## Files to Modify

- `packages/core/src/inbox/types.ts` - Add status and suspend fields
- `packages/core/src/inbox/inbox-storage.ts` - Add suspend/resume methods
- `packages/core/src/inbox/inbox.ts` - Add suspend/resume methods
- `packages/core/src/agent/agent.ts` - Handle suspension in processTask

## Changes

### 1. Update TaskStatus

```typescript
// packages/core/src/inbox/types.ts

export const TaskStatus = {
  PENDING: 'pending',
  CLAIMED: 'claimed',
  IN_PROGRESS: 'in_progress',
  WAITING_FOR_INPUT: 'waiting_for_input', // NEW
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;
```

### 2. Add Suspend Fields to Task

```typescript
// packages/core/src/inbox/types.ts

interface Task {
  // ... existing fields

  // Suspension
  suspendedAt?: Date;
  suspendPayload?: unknown; // Data for human (e.g., what to approve)
  resumePayload?: unknown; // Data from human (e.g., approval decision)
}

interface SuspendTaskInput {
  reason: string;
  payload?: unknown; // Data to show human
  resumeSchema?: z.ZodSchema; // Expected shape of resume data
}

interface ResumeTaskInput {
  payload: unknown; // Human's response
}
```

### 3. Add Storage Methods

```typescript
// packages/core/src/inbox/inbox-storage.ts

abstract class InboxStorage extends StorageDomain {
  // ... existing methods

  /**
   * Suspend a task to wait for human input.
   */
  abstract suspendTask(taskId: string, input: SuspendTaskInput): Promise<Task>;

  /**
   * Resume a suspended task with human input.
   */
  abstract resumeTask(taskId: string, input: ResumeTaskInput): Promise<Task>;

  /**
   * List tasks waiting for input.
   */
  abstract listWaitingTasks(inboxId?: string): Promise<Task[]>;
}
```

### 4. Add Inbox Methods

```typescript
// packages/core/src/inbox/inbox.ts

class Inbox {
  /**
   * Suspend task execution to wait for human input.
   */
  async suspend(taskId: string, input: SuspendTaskInput): Promise<void> {
    const storage = this.getStorage();
    await storage.suspendTask(taskId, input);
  }

  /**
   * Resume a suspended task with human input.
   */
  async resume(taskId: string, input: ResumeTaskInput): Promise<void> {
    const storage = this.getStorage();
    const task = await storage.resumeTask(taskId, input);

    // Re-queue for processing
    // The agent run loop will pick it up
  }

  /**
   * List tasks waiting for human input.
   */
  async listWaiting(): Promise<Task[]> {
    const storage = this.getStorage();
    return storage.listWaitingTasks(this.id);
  }
}
```

### 5. Agent Tool for Suspension

```typescript
// packages/core/src/inbox/tools.ts

import { createTool } from '../tools';

export const createSuspendTool = (inbox: Inbox, taskId: string) =>
  createTool({
    id: 'suspend-for-input',
    description: 'Pause task execution to request human input',
    inputSchema: z.object({
      reason: z.string(),
      question: z.string().optional(),
      options: z.array(z.string()).optional(),
      data: z.unknown().optional(),
    }),
    execute: async input => {
      await inbox.suspend(taskId, {
        reason: input.reason,
        payload: {
          question: input.question,
          options: input.options,
          data: input.data,
        },
      });

      // Signal to stop processing
      throw new TaskSuspendedError(taskId, input.reason);
    },
  });
```

### 6. Handle Suspension in processTask

```typescript
// packages/core/src/agent/agent.ts

async #processTask(task: Task, inbox: Inbox, options: AgentRunOptions) {
  try {
    // If task was suspended and now resumed, get resume payload
    const resumeData = task.status === TaskStatus.IN_PROGRESS && task.resumePayload
      ? task.resumePayload
      : undefined;

    // Add suspend tool to agent's tools for this task
    const suspendTool = createSuspendTool(inbox, task.id);

    const result = await this.stream({
      messages: [
        { role: 'user', content: JSON.stringify(task.payload) },
        // If resuming, add the human's response
        ...(resumeData ? [{ role: 'user', content: JSON.stringify(resumeData) }] : []),
      ],
      tools: { ...this.tools, suspend: suspendTool },
    });

    // ... complete task

  } catch (error) {
    if (error instanceof TaskSuspendedError) {
      // Task is suspended, don't mark as failed
      options.onTaskSuspended?.(task, error.reason);
      return;
    }
    // ... handle other errors
  }
}
```

### 7. Resume via API/UI

```typescript
// API endpoint example
// POST /api/inboxes/:inboxId/tasks/:taskId/resume

export async function POST(req: Request) {
  const { inboxId, taskId } = params;
  const { payload } = await req.json();

  const inbox = mastra.getInbox(inboxId);
  await inbox.resume(taskId, { payload });

  return Response.json({ success: true });
}
```

## UI Integration

Tasks in `waiting_for_input` status should show:

- Reason for suspension
- Question/options if provided
- Input form based on expected schema
- Resume button

```typescript
// UI component pseudocode
function WaitingTaskCard({ task }) {
  const { reason, question, options } = task.suspendPayload;

  return (
    <Card>
      <Status>Waiting for Input</Status>
      <Reason>{reason}</Reason>
      {question && <Question>{question}</Question>}
      {options ? (
        <OptionButtons options={options} onSelect={handleResume} />
      ) : (
        <TextInput onSubmit={handleResume} />
      )}
    </Card>
  );
}
```

## Example Flow

```typescript
// Agent instructions
const agent = new Agent({
  instructions: `
    You help with code reviews.
    If the changes look risky, use the suspend tool to request human approval.
  `,
  tools: { ... },
});

// Task processing
// 1. Agent analyzes PR
// 2. Agent sees risky changes
// 3. Agent calls suspend tool: "Approve deployment of database migration?"
// 4. Task goes to waiting_for_input
// 5. Human sees task in UI, clicks "Approve"
// 6. inbox.resume(taskId, { payload: { approved: true } })
// 7. Task continues processing with approval
// 8. Agent completes the review
```

## Acceptance Criteria

- [ ] TaskStatus includes WAITING_FOR_INPUT
- [ ] Task has suspendPayload and resumePayload fields
- [ ] inbox.suspend() pauses task
- [ ] inbox.resume() continues task with human input
- [ ] inbox.listWaiting() returns suspended tasks
- [ ] Agent can use suspend tool during processing
- [ ] Resumed task continues where it left off
- [ ] UI can display waiting tasks and collect input
