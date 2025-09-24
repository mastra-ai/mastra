# Human in the loop with tools

Often times an agent will call a tool that needs to be approved by a human. This may be due to reasons of security, privacy, compliance, etc.
Sometimes, a tool may be need to be suspended due to actions that happen during its execution. Perhaps, because the tool calls a more complex workflow, or depends on some external action.

In the latest release, we've introduced a few new concepts for such use cases.

## Tool approval

To enable tool approval, you can set the `requireApproval` property on the tool.

```typescript
const findUserTool = createTool({
  id: 'Find user tool',
  description: 'This is a test tool that returns the name and email',
  inputSchema: z.object({
    name: z.string(),
  }),
  execute: async ({ context }) => {
    return mockFindUser(context) as Promise<Record<string, any>>;
  },
});

const userAgent = new Agent({
  name: 'User agent',
  instructions: 'You are an agent that can get list of users using findUserTool.',
  model: openaiModel,
  tools: { findUserTool },
});

const mastra = new Mastra({
  agents: { userAgent },
  logger: false,
  storage: mockStorage,
});

const myAgent = mastra.getAgent('userAgent');
const stream = await myAgent.streamVNext('Find the user with name - John Smith', {
  requireToolApproval: true,
});
for await (const chunk of stream.fullStream) {
  console.log('stream chunk', chunk);
}
await new Promise(resolve => setTimeout(resolve, 1000));
const resumeStream = await agentOne.approveToolCall({ runId: stream.runId });
for await (const chunk of resumeStream.fullStream) {
  console.log('stream chunk', chunk);
}
```

In the above example, the agent stream has been closed due to a tool call that needs to be approved. In the original `.streamVNext()` call, we specify that every tool call should be approved. To continue execution of the agent stream call, we need to call `.approveToolCall()` with the `runId` of the original stream.

Similarly, if the tool call does not look right, we can call `.declineToolCall()` with the `runId` of the original stream to cancel the tool.

Tools may also be configured to require approval regardless of the setting on the stream call. This can be done using the `requireApproval` property on the tool:

```typescript
const findUserTool = createTool({
  id: 'Find user tool',
  description: 'This is a test tool that returns the name and email',
  inputSchema: z.object({
    name: z.string(),
  }),
  requireApproval: true,
  execute: async ({ context }) => {
    return mockFindUser(context) as Promise<Record<string, any>>;
  },
});
```

# Tool suspension

A tool can be suspended manually by calling the `suspend` function on the tool execution context. If a workflow is executed as a tool, the tool call will automatically be suspended when the workflow is suspended.

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
  execute: async ({ suspend, resumeData }) => {
    if (!resumeData) {
      return await suspend({ message: 'Please provide the name of the user' });
    }

    return {
      name: resumeData?.name,
      email: 'test@test.com',
    };
  },
});

const userAgent = new Agent({
  name: 'User agent',
  instructions: 'You are an agent that can get list of users using findUserTool.',
  model: openaiModel,
  tools: { findUserTool },
});

const mastra = new Mastra({
  agents: { userAgent },
  logger: false,
  storage: mockStorage,
});

const myAgent = mastra.getAgent('userAgent');

let toolCall;
const stream = await myAgent.streamVNext('Find the user with name - John Smith');
for await (const chunk of stream.fullStream) {
  console.log('stream chunk', chunk);
}
await new Promise(resolve => setTimeout(resolve, 1000));
const resumeStream = await myAgent.resumeStreamVNext({ name: 'John Smith' }, { runId: stream.runId });
for await (const chunk of resumeStream.fullStream) {
  console.log('stream chunk', chunk);
}
```

In such cases, by calling the `suspend()` function, the tool call will be suspended and the agent will wait for the tool to be resumed.

This happens via the `.resumeStreamVNext()` method, to which you can pass arbitrary `resumeData` to continue execution from the point of suspension. This `resumeData` will be available in the tool execution context, and if specified in the tool options, should match the schema of the `resumeSchema`.
