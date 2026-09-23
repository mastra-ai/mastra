---
'@mastra/playground-ui': minor
---

Removed `IntegrationDialog`. Mastra Platform now owns its connection picker, and nothing else in Mastra imported it. If you used it, copy the component from a previous release or build the picker with `Command` and `Dialog`.
