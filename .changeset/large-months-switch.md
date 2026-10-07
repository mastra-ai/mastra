---
'@mastra/memory': patch
---

Fixed Markdown working memory going stale when observational memory manages it. For single-thread observation, the observer must now always output the working memory section, writing UNCHANGED when nothing changed, and a missing section is recorded as an extraction failure instead of being silently dropped. Batched multi-thread observer calls keep the section optional. Schema working memory is unchanged. Fixes #25350.
