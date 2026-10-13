---
'@mastra/core': patch
---

Fixed document sources (e.g. Anthropic PDF citations) being saved to memory as URL sources with an empty url, which permanently lost the citation after a reload. Streamed document sources are now persisted as source-document parts with their sourceId, mediaType, title and filename, and the AI SDK v5 UI adapter now round-trips them instead of dropping them. URL sources also keep their sourceId and title when converted back from UI messages. Fixes #26795
