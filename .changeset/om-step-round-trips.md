---
'@mastra/core': patch
'@mastra/memory': patch
---

Reduced storage round trips that Observational Memory adds before each model call in a turn. Below the observation threshold, steps no longer re-check that the thread exists on every save, re-read the observed-message cursor, wait on the pending-token write (it is skipped when unchanged and otherwise queued in the background), or re-read resource-scoped working memory for the state signal. This cuts several sequential database round trips per model call, which is noticeable with remote databases. Fixes #27319.
