---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/react': patch
'@mastra/client-js': patch
---

Removes the deprecated `threadId` and `resourceId` options from `AgentExecutionOptions`. These have been deprecated for months in favour of the `memory` option.

### Breaking Changes

#### `@mastra/core`

The `threadId` and `resourceId` options have been removed from `agent.generate()` and `agent.stream()`. Use the `memory` option instead:

```ts
// Before
await agent.stream('Hello', {
  threadId: 'thread-123',
  resourceId: 'user-456',
});

// After
await agent.stream('Hello', {
  memory: {
    thread: 'thread-123',
    resource: 'user-456',
  },
});
```

#### `@mastra/server`

The `threadId`, `resourceId`, and `resourceid` fields have been removed from the main agent execution body schema. The server now expects the `memory` option format in request bodies. Legacy routes (`/api/agents/:agentId/generate-legacy` and `/api/agents/:agentId/stream-legacy`) continue to support the deprecated fields.

#### `@mastra/react`

The `useChat` hook now internally converts `threadId` to the `memory` option format when making API calls. No changes needed in component code - the hook handles the conversion automatically.

#### `@mastra/client-js`

When using the client SDK agent methods, use the `memory` option instead of `threadId`/`resourceId`:

```ts
const agent = client.getAgent('my-agent');

// Before
await agent.generate([...], {
  threadId: 'thread-123',
  resourceId: 'user-456',
});

// After
await agent.generate([...], {
  memory: {
    thread: 'thread-123',
    resource: 'user-456',
  },
});
```
