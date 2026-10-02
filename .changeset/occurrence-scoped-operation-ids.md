---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed durable workflow operation IDs repeating across `dountil`/`dowhile` iterations and `foreach` items, including nested workflows used as a loop body or `foreach` step. Replay engines such as `@mastra/inngest` memoize by operation ID, so repeated IDs could bind a cached result to the wrong iteration or item. Each loop iteration after the first and every `foreach` item now gets its own ID.

**Upgrade note:** operation IDs change for every operation inside a `foreach` item (including the first item) and for loop iterations 2 and later. Runs suspended in either position before upgrading will re-execute those operations on resume instead of replaying their recorded results. Operations outside loops and `foreach`, and first loop iterations, keep their existing IDs.
