---
'@mastra/core': patch
---

`processToolResult` now sees and can rewrite a tool's `toModelOutput` result. Previously, when a tool mapped its result with `toModelOutput` (for example a file viewer returning images), output processors only saw and changed the raw result, and the mapped output, images included, still reached the next model call and stored history unchanged.

The hook now receives `modelOutput`. To replace it, commit a `result`-state part that carries the new value in `providerMetadata.mastra.modelOutput`:

```ts
processToolResult({ messageList, toolCallId, toolName, args, result, modelOutput }) {
  messageList.updateToolInvocation({
    type: 'tool-invocation',
    toolInvocation: { state: 'result', toolCallId, toolName, args, result },
    providerMetadata: { mastra: { modelOutput: shrinkImages(modelOutput) } },
  });
}
```

A processor that replaces only `result`, or edits it in place, now has the new value mapped through `toModelOutput` again, so the model reads the mapping of the processed result rather than of the original. With several processors, each one receives the `modelOutput` the processor before it committed, so a later processor can't bring back an image an earlier one removed. This applies to both regular and durable agents. In durable agents, a `processToolResult` that throws now also keeps the unprocessed mapped output from the model, not only the raw result.
