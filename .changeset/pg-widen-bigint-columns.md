---
'@mastra/pg': patch
---

`PgFactoryStorage` now widens an `integer` column to `bigint` when the collection schema says so, the way it already adds missing columns and drops stale `NOT NULL`. A Factory deployed before `factory_attention_receipts.occurrence` became `bigint` no longer needs a hand-run `ALTER TABLE` before parked-run receipts can be written.
