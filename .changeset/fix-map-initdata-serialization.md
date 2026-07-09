---
'@mastra/core': patch
---

Fix heap OOM when a workflow uses `.map({ key: mapVariable({ initData: <workflow> }) })`. The map reducer kept the live `Workflow` instance by reference and `JSON.stringify`'d it into the map step's `mapConfig`, deep-walking the whole workflow (its logger, nested step graph, …) into a multi-hundred-MB string — and the length-guard truncation only ran after the full string was built, so `.commit()` could OOM at module load. The `initData` mapping is now serialized as a slim `{ initData: <id>, path }` reference. Runtime behavior is unchanged (the execute path only reads `initData` for truthiness).
