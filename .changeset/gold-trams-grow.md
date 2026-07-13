---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
'@mastra/spanner': minor
---

Added atomic caller-defined dataset IDs for idempotent dataset creation across built-in storage adapters. Supplying `id` to `mastra.datasets.create()` now creates the dataset once and resolves compatible retries to the persisted record; incompatible immutable identity fields throw `DATASET_ID_CONFLICT`.
