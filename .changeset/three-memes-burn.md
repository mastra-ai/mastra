---
'@mastra/rag': patch
---

Fixed recursive chunking, and character chunking with an empty separator, splitting emoji and other characters outside the Basic Multilingual Plane in half. Chunks now always contain whole characters, so they no longer hold invalid text that turns into replacement characters (�) when stored or embedded. Fixes [#29268](https://github.com/mastra-ai/mastra/issues/29268).
