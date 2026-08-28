---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mysql': minor
'@mastra/pg': minor
---

Move experimental subconscious curation policy onto the `curate` agent entry. Configure it with
`curate.trigger: { uncuratedRecords, maxAgeMs }`; observation placement evaluates after a completed
observation pipeline, while reflection placement evaluates at reflection commit. Existing top-level
`curationThreshold` and `curationMaxAgeMs` options translate to those trigger fields. The deprecated
`curationCadence` value is also carried across unchanged, but its meaning changes from committed
observation runs to uncurated knowledge records, so the same number may produce a different cadence.

Curation retry state now uses a lane-scoped `KnowledgeStorage` capability implemented by the bundled
adapters, which create a `mastra_knowledge_curation_state` table or collection during non-destructive
initialization. No-op, no-model, non-advancing, and failed attempts use the same lazy retry backoff.
Older custom adapters remain compatible through process-local backoff, which is not durable across
evaluator or process restarts. The prior record-config state existed only on the unmerged experimental
branch and is intentionally not copied into the new storage record.
