---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/libsql': patch
---

Fixed large initial Observational Memory histories loading all at once with InMemory and LibSQL storage. When enabling OM on existing messages without an OM record, read backward from the newest messages until the observation blocking budget is reached. Persist the lower timestamp/ID boundary before observation so older history cannot return after a failure or restart, including resource-scoped history and equal timestamps. Existing OM records continue resuming their bounded history pages; adapters without reverse-bootstrap and atomic-initialization support retain their existing behavior. When a lower cutoff is required, commit that retained initial history before live asynchronous buffering resumes; histories that fit the budget keep normal explicit-message and buffering behavior.
