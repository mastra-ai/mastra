---
'@mastra/core': patch
---

Fixed workflow run streams (`WorkflowRunOutput`) swallowing stream pipeline errors, which could hang callers forever.

When the underlying stream errored (for example a provider/transport failure mid-run), the error was swallowed and the run never finalized — `await output.result` / `output.usage` and any `fullStream` consumers waited forever. These now reject with the error, the run is marked `failed`, and consumers receive a terminal `workflow-finish` event and close.

```ts
const result = await run.stream(input).result; // before: hung forever on a stream error
                                               // after:  rejects with the error
```
