# Using Mastra Subagents with Durable Workflows

When using an external engine like Vercel Workflow SDK to own the chat lifecycle, you can orchestrate Mastra subagents to perform long-running background tasks (e.g., a coding agent) that persist even if the user disconnects.

## Architecture Recommendation

To achieve background execution with subagents while using an external durable runner:

### 1. The Handoff Pattern

The supervisor agent should use a tool to trigger the background work. Instead of the supervisor waiting for a long-running subagent call during a synchronous stream, it should emit a "task started" state.

### 2. Implementation Example

```ts
// 1. Define the tool that triggers the background process
const startCodingTask = createTool({
  id: 'startCodingTask',
  execute: async ({ projectId, instructions }, { runId }) => {
    // Start the durable background workflow
    await workflow.start('background-coder', {
      input: { projectId, instructions, parentRunId: runId },
    });
    
    return { status: 'started', message: 'Coding task initiated in the background.' };
  },
});

// 2. The Durable Workflow
export const backgroundCoder = workflow.define('background-coder', async (context) => {
  const { projectId, instructions } = context.input;

  // Use Mastra Agent inside the durable step
  const result = await step.run('run-agent', async () => {
    return await codingAgent.generate(instructions, {
      resourceId: projectId,
    });
  });

  // Notify or update the main chat thread via your database/memory
  await step.run('notify-completion', async () => {
    await mastra.memory.create({ 
       threadId: context.input.parentRunId, 
       content: `Background task complete: ${result.text}` 
    });
  });
});
```

### 3. Key Considerations

- **State Sync**: Use Mastra's `Memory` or a shared Postgres instance (`@mastra/pg`) so the background subagent and the foreground supervisor share the same thread history.
- **Reconnection**: Since the workflow ID is persisted (e.g., `agent_chats.activeStreamId`), the client can poll the workflow status or use a WebSocket/Server-Sent Events to listen for the completion message added to the memory thread.
- **Context Injection**: Use `inputProcessors` to inject the `projectId` or internal context into the subagent's runtime so it knows which environment it is operating in.