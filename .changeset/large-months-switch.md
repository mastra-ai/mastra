---
'@mastra/memory': patch
---

Fixed Markdown working memory going stale when observational memory manages it. The observer must now always write the working memory section, or `UNCHANGED` when nothing changed, and a missing section is recorded as an extraction failure. Fixes #25350.
