---
'@mastra/core': major
'@mastra/voice-google-gemini-live': patch
'@mastra/voice-openai-realtime': patch
'@mastra/mcp-docs-server': patch
'@mastra/langsmith': patch
'@mastra/agent-builder': patch
'@mastra/client-js': patch
'@mastra/inngest': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/dane': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/rag': patch
---

Update tool execution signature

Consolidated the 3 different execution contexts to one

```typescript
// before depending on the context the tool was executed in
tool.execute({ context: data });
tool.execute({ context: { inputData: data } });
tool.execute(data);

// now, for all contexts
tool.execute(data, context);
```

**Before:**

```typescript
inputSchema: z.object({ something: z.string() }),
execute: async ({ context, tracingContext, runId, ... }) => {
  return doSomething(context.string);
}
```

**After:**

```typescript
inputSchema: z.object({ something: z.string() }),
execute: async (inputData, context) => {
  const { agent, mcp, workflow, ...sharedContext } = context

  // context that only an agent would get like toolCallId, messages, suspend, resume, etc
  if (agent) {
    doSomething(inputData.something, agent)
  // context that only a workflow would get like runId, state, suspend, resume, etc
  } else if (workflow) {
    doSomething(inputData.something, workflow)
  // context that only a workflow would get like "extra", "elicitation"
  } else if (mcp) {
    doSomething(inputData.something, mcp)
  } else {
    // Running a tool in no execution context
    return doSomething(inputData.something);
  }
}
```
