---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added durable score monitors with webhook alerts. Define a monitor with a score filter, evaluation window, aggregation (avg, p50, p95, count, pass rate), and threshold; Mastra evaluates active monitors in the background and delivers a webhook on breach and recovery, with cooldown to suppress repeats. Breach history is persisted per monitor and Studio includes a Monitors page for managing monitors and drilling down from a breach to the matching scores. Serverless deployments can trigger evaluation via `POST /api/monitors/evaluate`.
