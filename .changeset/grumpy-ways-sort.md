---
'@mastra/ai-sdk': patch
'@mastra/react': patch
'@mastra/core': patch
---

Mapped the new `tool-call-resumed` chunk to a `data-tool-call-suspended` part with `resumed: true` and the same id, so UIs update the suspension part in place once it is answered.
