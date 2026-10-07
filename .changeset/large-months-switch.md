---
'@mastra/memory': patch
---

Fixed Markdown working memory going stale when observational memory manages it. In single-thread observer calls, the observer is now told to always output the working memory section and to write `UNCHANGED` when nothing changed. A missing section is now recorded as an extraction failure instead of being dropped silently. Batched multi-thread observer calls keep the section optional, so a missing section there is not recorded as a failure. Working memory with a schema keeps its current behavior. Fixes #25350.
