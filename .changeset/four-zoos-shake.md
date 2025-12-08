---
'@mastra/client-js': patch
---

Fix `saveMessageToMemory` return type to match API response. The method now correctly returns `{ messages: MastraDBMessage[] }` instead of `MastraDBMessage[]` to align with the server endpoint response schema.
