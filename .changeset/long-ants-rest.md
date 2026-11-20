---
'@mastra/inngest': patch
---

Fixed the resumed part of a `createInngestAgent` run losing the thread id and resource id on its spans, so filters by thread or resource find the whole run.
