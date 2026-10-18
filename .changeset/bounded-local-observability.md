---
'@mastra/code-sdk': patch
---

Fixed the local trace store (`observability.duckdb`, used when `/observability local on`) growing without limit. Each session now deletes traces, logs and metrics older than 14 days and scores and feedback older than 30 days in the background, capped per session so startup is never blocked.
