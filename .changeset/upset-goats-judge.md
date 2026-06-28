---
'@mastra/core': patch
---

Fixed two bugs in workflow run streaming (`WorkflowRunOutput`) that broke multi-consumer streams and could hang callers forever.

**Cancelling one stream consumer no longer breaks the others**

`fullStream` supports multiple consumers reading the same run. Previously, cancelling one consumer removed every consumer's listeners, so the remaining readers stopped receiving chunks and never closed (their `for await` loops hung). Each consumer now detaches only its own listeners on cancel.

```ts
const a = output.fullStream.getReader();
const b = output.fullStream.getReader();

await a.cancel(); // before: b stopped receiving chunks and never closed
                  // after:  b keeps streaming and closes normally
```

**Stream pipeline errors now surface instead of hanging**

When the underlying stream errored (for example a provider/transport failure mid-run), the error was swallowed and the run never finalized — `await output.result` / `output.usage` and any `fullStream` consumers waited forever. These now reject with the error, the run is marked `failed`, and consumers receive a terminal `workflow-finish` event and close.

```ts
const result = await run.stream(input).result; // before: hung forever on a stream error
                                               // after:  rejects with the error
```
