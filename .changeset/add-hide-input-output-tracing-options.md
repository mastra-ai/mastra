---
'@mastra/core': minor
'@mastra/observability': minor
---

Add `hideInput` and `hideOutput` options to `TracingOptions` for protecting sensitive data in traces.

When set to `true`, these options hide input/output data from all spans in a trace, including child spans. This is useful for protecting sensitive information from being logged to observability platforms.

```typescript
const agent = mastra.getAgent('myAgent');
await agent.generate('Process this sensitive data', {
  tracingOptions: {
    hideInput: true,  // Input will be hidden from all spans
    hideOutput: true, // Output will be hidden from all spans
  },
});
```

The options can be used independently (hide only input or only output) or together. The settings are propagated to all child spans via `TraceState`, ensuring consistent behavior across the entire trace.

Fixes #10888
