---
'@mastra/core': patch
---

Fixed resumed agent runs disappearing from storage before their final messages are saved. Final message-save failures now report an error instead of a successful completion. Fixes [#27445](https://github.com/mastra-ai/mastra/issues/27445).
