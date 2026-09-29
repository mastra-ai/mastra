---
'mastracode': patch
'@mastra/code-sdk': patch
'@mastra/core': patch
---

A paused goal now says why it paused. `/goal status` and the goal modal show the cause — evaluation budget exhausted, or a judge that failed to evaluate — and it survives a reload instead of disappearing after the moment it happened. Resuming or completing a goal clears the cause, so a later pause never shows a stale one.
