---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/client-js': patch
'@mastra/server': patch
---

Added first-class external score ingestion. Scores produced outside Mastra — human review queues, offline pipelines, external workers — can be posted with `source: 'EXTERNAL'` and an optional caller-supplied `id` that makes retries idempotent: reposting the same id upserts instead of duplicating, preserving the original `createdAt`. External scores appear alongside live scorer results in queries, aggregates, and Studio.
