---
'@mastra/client-js': patch
---

Fix `saveMessageToMemory` return type to match API response. The method now correctly returns `{ messages: (MastraMessageV1 | MastraDBMessage)[] }` instead of `(MastraMessageV1 | MastraDBMessage)[]` to align with the server endpoint response schema.
