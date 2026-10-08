---
'@mastra/core': minor
---

Added `outputPreview` to trace list rows. `listTracesLight` and `queryTraces` now return short previews of both the root span input and output. The preview format depends on the span type: agent and model spans show the user prompt and the reply text, and suspended or interrupted runs show their status. Workflow, tool and custom spans fall back to JSON. Raw input and output are never part of the response.

Storage adapters that previously overrode `listTracesLight` or `queryTraces` should now implement the protected `listTraceRootRows` or `queryTraceRows` methods and return raw rows; the core builds the previews.

```ts
const { spans } = await storage.listTracesLight({});
spans[0].inputPreview; // 'What is the weather in Paris?'
spans[0].outputPreview; // 'Sunny, 21°C'
```
