# Human in the loop with tools

Agents frequently invoke tools that may require human approval before execution. This requirement stems from security protocols, privacy regulations, compliance mandates, or simply organizational preference for human oversight.

Additionally, tools may need to be suspended mid-execution due to dynamic conditions that arise during their operation. This commonly occurs when a tool initiates complex workflows or depends on external actions that require intervention or validation.

In the latest release, we've introduced a few new concepts for such use cases.

## Tool approvals

Enforcing approval on all tools

```typescript
const stream = await myAgent.streamVNext('Find the user with name - John Smith', {
  requireToolApproval: true,
});
```

Passing `requireToolApproval` to your `generateVNext` or `streamVNext` call will close the stream when the agent encounters a tool call. To continue execution of the agent stream call, we need to call `.approveToolCall()` with the `runId` of the original stream.

```typescript
const resumedStream = await myAgent.approveToolCall({ runId: stream.runId });
```

If the tool call should not be executed, we call `.declineToolCall()` with the `runId` of the original stream to cancel the tool.

```typescript
await myAgent.declineToolCall({ runId: stream.runId });
```

Enforcing on individual tools

```typescript
const findUserTool = createTool({
  id: 'Find user tool',
  description: 'This is a test tool that returns the name and email',
  inputSchema: z.object({
    name: z.string(),
  }),
  execute: async inputData => {
    return mockFindUser(inputData) as Promise<Record<string, any>>;
  },
  requireApproval: true,
});
```

When the agentic loop attempts to execute the `findUserTool` it will close the stream allowing you to either `.approveToolCall()` or `.declineToolCall()`

## Tool suspension

You may want to control the logic for suspending tool calls. A tool can be suspended manually by calling the `suspend` function. Similar to Mastra workflows, calling `suspend` gives you control. You define the shape of the suspension with `suspendSchema` and define the shape of how to resume with `resumeSchema`.

```typescript
const findUserTool = createTool({
  id: 'Find user tool',
  description: 'This is a test tool that returns the name and email',
  inputSchema: z.object({
    name: z.string(),
  }),
  suspendSchema: z.object({
    message: z.string(),
  }),
  resumeSchema: z.object({
    name: z.string(),
  }),
  execute: async (inputData, { workflow }) => {
    if (!workflow.resumeData) {
      return await workflow.suspend({ message: 'Please provide the name of the user' });
    }

    return {
      name: workflow?.resumeData?.name,
      email: 'test@test.com',
    };
  },
});
```

In this case, by calling the `suspend()` function, the tool call will be suspended and the agent will wait for the tool to be resumed.

You can resume with the `.resumeStreamVNext()` method. You pass `resumeData` to continue execution from the point of suspension. This `resumeData` will be available in the tool execution context, and if specified in the tool options, should match the schema of the `resumeSchema`.

```typescript
const resumedStream = await myAgent.resumeStreamVNext({ name: 'John Smith' }, { runId: stream.runId });

for await (const chunk of resumedStream.fullStream) {
  console.log('stream chunk', chunk);
}
```
