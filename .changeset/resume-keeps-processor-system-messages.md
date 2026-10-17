---
'@mastra/core': patch
---

Fixed system messages added by input processors (such as the `TaskSignalProvider` task-list instruction) going missing when an `Agent` resumes after tool approval. Fixes #24844.

Resumed runs now reuse the system prompt from the suspended run, matching durable agents. Instructions or system messages passed only at resume time no longer replace it.
