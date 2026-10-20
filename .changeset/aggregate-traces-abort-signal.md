---
'@mastra/client-js': patch
---

`aggregateTraces()` now accepts an optional abort signal, so callers can cancel an aggregation that is no longer needed:

```ts
const controller = new AbortController();
const result = client.aggregateTraces(request, { signal: controller.signal });
controller.abort();
```
