---
'@mastra/memory': minor
---

Move experimental subconscious curation policy onto the `curate` agent entry. Configure it with
`curate.trigger: { uncuratedRecords, maxAgeMs }`; observation placement evaluates after a completed
observation pipeline, while reflection placement evaluates at reflection commit. Existing top-level
`curationThreshold` and `curationMaxAgeMs` options translate to those trigger fields. The deprecated
`curationCadence` value is also carried across unchanged, but its meaning changes from committed
observation runs to uncurated knowledge records, so the same number may produce a different cadence.
