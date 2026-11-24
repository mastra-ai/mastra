---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/libsql': patch
---

Fixed large initial Observational Memory histories loading all at once with InMemory and LibSQL storage. When enabling OM on existing messages without an OM record, retain only the newest history within the observation blocking budget. Older messages remain outside the model context, including after a failed observation or restart.

Existing OM records catch up in bounded message and token batches before normal asynchronous buffering resumes. A single oversized message is still processed so catch-up cannot stall. Copied threads start with their own history boundary rather than skipping messages using the source thread's message IDs. Other storage adapters keep their existing loading behavior.
