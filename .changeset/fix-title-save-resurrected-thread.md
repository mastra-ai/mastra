---
'@mastra/core': patch
---

Fixed a generated title re-creating a thread that was deleted while the title was being generated. The background title save now updates the existing thread instead of upserting it, so a deleted thread stays deleted.

Fixes #25203
