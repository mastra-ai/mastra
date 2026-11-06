---
'@mastra/server': patch
---

Listing an agent controller session's threads with `tags` now filters by those tags in storage when every tag key is a valid metadata filter key, such as `projectPath`, instead of loading every thread of the resource and filtering them afterwards.
