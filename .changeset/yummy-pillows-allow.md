---
'@mastra/pg': patch
---

Fixed a startup crash when multiple processes, such as an API and a worker, initialize the same empty Postgres schema at the same time. Startup no longer waits unnecessarily for indexes another process is creating. It also repairs broken indexes left behind by interrupted index builds when the affected table is available.
