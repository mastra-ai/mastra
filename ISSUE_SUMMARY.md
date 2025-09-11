# Issue #7722: onFinish object undefined

## Problem Statement

When using `agent.generateVNext()` with structured output via the `output` parameter, the `onFinish` callback receives a result where `result.object` is undefined, even though the main function returns the structured data correctly.

## Code Analysis

### User's Code

```typescript
const response = await agent.generateVNext(
  [
    {
      role: 'user',
      content: prompt(query),
    },
  ],
  {
    output: JournalistSearchResultSchema,
    onFinish: async result => {
      console.log('Agent finished with output:', result.object); // undefined
    },
    context: [{ role: 'user', content: `searchId for use when calling tools: ${searchId}` }],
  },
);
```

### Root Cause

In `/packages/core/src/stream/base/output.ts` at line 498, the onFinish callback is invoked with a payload that doesn't include the `object` field:

```typescript
const onFinishPayload = {
  text: baseFinishStep.text,
  warnings: baseFinishStep.warnings ?? [],
  finishReason: chunk.payload.stepResult.reason,
  content: messageList.get.response.aiV5.stepContent(),
  request: await self.request,
  error: self.error,
  reasoning: await self.aisdk.v5.reasoning,
  reasoningText: await self.aisdk.v5.reasoningText,
  sources: await self.aisdk.v5.sources,
  files: await self.aisdk.v5.files,
  steps: transformSteps({ steps: self.#bufferedSteps }),
  response: { ...(await self.response), messages: messageList.get.response.aiV5.model() },
  usage: chunk.payload.output.usage,
  totalUsage: self.#getTotalUsage(),
  toolCalls: await self.aisdk.v5.toolCalls,
  toolResults: await self.aisdk.v5.toolResults,
  // ... other fields
};

await options?.onFinish?.(onFinishPayload);
```

The `object` field is resolved separately in the delayed promises but is not included in the onFinish payload.

### How The Issue Can Be Reproduced

1. Create an agent with structured output schema
2. Call `generateVNext` with the `output` parameter and an `onFinish` callback
3. The `onFinish` callback will receive a result without the `object` field
4. However, the main function will correctly return the structured data when awaited

### Expected Behavior

The `onFinish` callback should receive the structured output object in its payload when using the `output` parameter, matching what the main function returns.

### Files Involved

- `/packages/core/src/stream/base/output.ts` - Contains the MastraModelOutput class where onFinish is called
- `/packages/core/src/agent/agent.ts` - Contains the generateVNext method that uses MastraModelOutput

### Fix Strategy

The `object` field needs to be added to the onFinish payload. The object is already being resolved and stored in `self.#delayedPromises.object`, so we need to await it and include it in the onFinish payload.
