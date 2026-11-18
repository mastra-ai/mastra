---
'@mastra/platform': patch
---

`PlatformKnowledge` now registers under the stable id `platform-knowledge` (was random per boot), and a missing instance ID fails at construction with an error naming `MASTRA_KNOWLEDGE_INSTANCE_ID`.
