---
'@mastra/server': patch
'@mastra/core': minor
---

Fix custom metadata preservation in UIMessages when loading threads. The `getMessagesHandler` now converts `messagesV2` (V2 format with metadata) instead of `messages` (V1 format without metadata) to AIV5.UI format. Also updates the abstract `MastraMemory.query()` return type to include `messagesV2` for proper type safety.
