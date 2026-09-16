---
'@mastra/code-sdk': patch
'mastracode': patch
---

Added fallback model packs and pack-specific subscription routing. In `/models`, you can configure a fallback chain and choose a preferred OAuth account for each model in a pack. Requests try the preferred account, then the provider's remaining accounts in insertion order. Exhausted accounts stay skipped for that model and thread, and a fallback pack applies its own routing. Pack hops remain visible in the transcript and persist when you reopen the thread.
