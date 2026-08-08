---
'@mastra/mysql': minor
---

Added an explicit `MYSQL_DATASET_ITEM_TIMEOUT_UNSUPPORTED` error for dataset item writes that include `timeout`, such as `dataset.addItem({ input, timeout: 5_000 })`, instead of silently dropping the execution control.
