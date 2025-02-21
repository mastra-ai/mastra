---
'@mastra/core': patch
---

Fixed a bug where masked tags don't work when a chunk includes other text (ex "o <start_tag" or "tag> w") in the maskStreamTags() util
