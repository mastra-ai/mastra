---
'@mastra/core': patch
---

Fixed evented workflow runs failing after a single dropped database connection or a short database outage. A failed workflow event used to be retried three times within milliseconds, so the run failed before the database came back. The engine now waits about 0.5 to 1 second before the first retry and 2 to 4 seconds before the second. A run survives an outage of up to roughly 2.5 seconds, and other runs keep progressing while one waits. An event that keeps failing, for example because a table is missing, now takes a few seconds to fail its run instead of failing it at once. Stopping workers or shutting down ends any pending wait so the event is handed back right away.
