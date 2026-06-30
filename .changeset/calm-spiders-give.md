---
'@mastra/core': patch
---

Fixed thread metadata being lost when a processor or working memory writes to it during an agent run. The thread is re-saved when the run finishes, and it was using a stale in-memory snapshot that overwrote any metadata written mid-run via updateThread. The agent now re-reads the latest persisted thread before that save, so mid-run metadata is preserved. Affects all storage backends (Postgres, LibSQL, and others). Fixes #16216.
