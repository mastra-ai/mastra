---
'@mastra/core': patch
---

Stopped rewriting the thread row when persisting messages. Message history read the thread and immediately wrote it back unchanged, which added a thread UPDATE to every turn and could overwrite a title written concurrently by title generation with the stale value read moments earlier. Saving messages already bumps the thread's updatedAt, so the write was redundant.

Fixes #20252
