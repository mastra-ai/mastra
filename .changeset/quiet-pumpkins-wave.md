---
'@mastra/core': patch
---

Fix `response.modelId` being overwritten with `undefined` in `step-finish` chunks when the upstream model stream omits `modelId` from `response-metadata`. The explicit empty-string fallback was placed before a `...otherMetadata` spread that could overwrite it with `undefined`. Moved the `modelId` assignment after the spread so the fallback always wins.

This restores consistent `response.modelId === ''` behavior across both the direct and evented agentic-loop workflow paths.
