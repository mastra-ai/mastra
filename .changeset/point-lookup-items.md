---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
'@mastra/spanner': minor
---

Add `getItemAtVersion` point lookup to the datasets storage domain. It returns the single dataset item visible at a pinned dataset version using SCD-2 range semantics, with an indexed query in every storage adapter. `Dataset.runExperimentItem` and `Dataset.submitExperimentResult` now use it to resolve items, so per-item caller-driven experiment calls no longer materialize the full dataset at the pinned version on each request.
