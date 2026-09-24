---
'@mastra/duckdb': patch
---

Fixed completed event spans appearing to still be running, including event spans stored before this fix. Event spans now report an end time equal to their start time, matching the ClickHouse and PostgreSQL stores.
