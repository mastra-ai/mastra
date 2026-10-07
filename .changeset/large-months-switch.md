---
'@mastra/memory': patch
---

Fixed Markdown working memory going stale in single-thread observer calls when observational memory manages it. The observer must now always output the working memory section, writing UNCHANGED when nothing changed, and a missing section is recorded as an extraction failure instead of being silently dropped. Batched multi-thread observer calls keep the section optional, so a dropped update there is still not recorded. Schema working memory is unchanged. Fixes #25350.

Added a `required` option to `Extractor`. Marks an inline extractor section as required in single-thread observer and reflector calls: a missing section is recorded in `extractionFailures`, and the model writes `UNCHANGED` when nothing changed, which is skipped rather than stored. Batched multi-thread observer calls treat it as optional.
