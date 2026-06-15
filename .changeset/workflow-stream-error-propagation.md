---
'@mastra/core': patch
---

Fixed streamed workflows hanging forever when the underlying stream pipeline errors.

Previously, if a step's stream rejected (for example a flaky LLM provider failing mid-run), `await run.stream(...).result` (and `.status` / `.usage`) would never settle and the caller would deadlock with no error and no timeout. These promises now reject with the underlying error, matching the behavior already used by agent network streams.

```ts
const run = await workflow.createRunAsync();
const stream = run.stream({ inputData });

try {
  const result = await stream.result; // now rejects instead of hanging if the stream errors
} catch (error) {
  // handle the provider/transport failure
}
```
