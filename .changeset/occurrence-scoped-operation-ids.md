---
'@mastra/core': patch
---

Fixed durable workflow operation IDs repeating across `dountil`/`dowhile` iterations and `foreach` items. Replay engines such as `@mastra/inngest` memoize by operation ID, so repeated IDs could bind a cached result to the wrong iteration or item. Each loop iteration after the first and each `foreach` item now gets its own ID; operations that run once keep their existing IDs, so runs that were suspended before upgrading still resume.
