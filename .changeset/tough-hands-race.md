---
'@mastra/factory': patch
'@mastra/auth-studio': patch
---

Speed up Factory hot paths: cache verified Studio auth credentials (30s TTL) with bounded verify fetches, parallelize GitHub repository sync with Platform response caching, deduplicate concurrent session workspace materialization with sandbox command timeouts, and bound dispatcher lease scans with queue-table indexes. Adds boot/auth timing instrumentation.
