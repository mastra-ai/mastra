---
'@mastra/clickhouse': patch
---

Fixed slow feedback review-status updates on ClickHouse. Since 1.21.0, each update ran a ClickHouse mutation that scanned every part of the feedback table, taking several seconds on tables with months of daily partitions and timing out on larger ones. Review updates now write a new row again, which takes milliseconds regardless of table size.

**Upgrade note:** the runtime database user no longer needs `ALTER UPDATE(reviewStatus)` on `mastra_feedback_events` or `INSERT` on `mastra_feedback_events_delta` for review updates. Grants you added for 1.21.0 are harmless. Keep `ALTER UPDATE` if you run ClickHouse 26.6 or earlier, because lightweight deletes still need it there.

Deleted feedback still can't reappear through a review update: an update that lands during a delete of the same feedback retries the delete and reports the feedback as not found. A failed delete no longer blocks review updates: the next update saves the new status, then retries the delete and reports its error if it fails again. If a network error or a lagging replica lets a review row outlive a successful delete, the next review update of that feedback removes it.
