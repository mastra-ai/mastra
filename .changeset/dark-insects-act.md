---
'@mastra/ai-sdk': patch
---

Support streaming agent text chunks from workflow-step-output

Adds support for streaming text and tool call chunks from agents running inside workflows via the workflow-step-output event. When you pipe an agent's stream into a workflow step's writer, the text chunks, tool calls, and other streaming events are automatically included in the workflow stream and converted to UI messages.

**Features:**
- Added `includeTextStreamParts` option to `WorkflowStreamToAISDKTransformer` (defaults to `true`)
- Added `isMastraTextStreamChunk` type guard to identify Mastra chunks with text streaming data
- Support for streaming text chunks: `text-start`, `text-delta`, `text-end`
- Support for streaming tool calls: `tool-call`, `tool-result`
- Comprehensive test coverage in `transformers.test.ts`
- Updated documentation for workflow streaming and `workflowRoute()`

**Example:**
```typescript
const planActivities = createStep({
  execute: async ({ mastra, writer }) => {
    const agent = mastra?.getAgent('weatherAgent');
    const response = await agent.stream('Plan activities');
    await response.fullStream.pipeTo(writer);
    
    return { activities: await response.text };
  }
});
```

When served via `workflowRoute()`, the UI receives incremental text updates as the agent generates its response, providing a smooth streaming experience.

