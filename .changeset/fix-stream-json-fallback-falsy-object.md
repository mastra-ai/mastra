---
'@mastra/core': patch
---

Fix `tryStreamWithJsonFallback` treating a valid falsy structured-output value as undefined. The first-attempt check used `!object`, so a schema resolving to a falsy-but-defined value (e.g. `z.boolean()` -> `false`, `z.number()` -> `0`) was wrongly rejected and triggered an unnecessary JSON-prompt fallback stream. It now checks `object === undefined`, matching the generate path and the stream fallback path.
