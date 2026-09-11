---
'@mastra/otel-exporter': patch
---

Keep workflow step identity and branch attributes in exported OTel spans.

`getSpanName` derived every span's name from `entityName`, which workflow control-flow spans inherit from the enclosing workflow rather than setting themselves. Sibling steps therefore exported under one shared name, and a branch's predicates were indistinguishable from each other. A step span now names itself by its own step id, and a conditional, parallel, loop, sleep or wait-event span keeps its own name.

`getAttributes` had no case for workflow span types, so their attributes never reached the exporter at all. The routing a run took is now exported: `conditionCount`, `truthyIndexes` and `selectedSteps` for a branch, `conditionIndex` and `result` for each predicate, and the equivalents for parallel, loop, sleep and wait-event spans.

This reaches every consumer of the shared conversion layer, including Langfuse, Arize, Arthur, Sentry and the OTel bridge.

Fixes #23579.
