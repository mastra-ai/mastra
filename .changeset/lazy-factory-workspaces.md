---
'@mastra/factory': minor
---

Made Factory session workspace resolution lazy. Resolving a session now returns the workspace immediately with a lazy sandbox handle; sandbox provisioning, repository materialization, branch checkout, and setup run in the background at session start (or on the first filesystem/sandbox operation) instead of blocking agent start. Storage reads during resolution are parallelized, failed background materializations are retried on the next use, and metadata-only resolutions such as thread-list polling never trigger sandbox work.
