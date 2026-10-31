---
'@mastra/pg': patch
---

Fixed slow startup when several processes initialize the same Postgres schema for the first time. Each index build waited about a second on the other processes, so two processes cold-booting together took around 20 seconds instead of a fraction of a second. Indexes on tables that did not exist when initialization began are now built directly instead of concurrently; indexes on tables that already existed are still built concurrently.
