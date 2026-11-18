---
'@mastra/platform': patch
---

`PlatformKnowledge` now registers under the stable id `platform-knowledge-<instanceId>` (was random per boot), so two instances with different instance IDs still register side by side, and a missing instance ID now fails at construction with its own error naming `MASTRA_KNOWLEDGE_INSTANCE_ID`.
