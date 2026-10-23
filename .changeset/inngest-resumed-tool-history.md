---
'@mastra/inngest': patch
---

Fixed resumed Inngest agent output so it includes tool calls made before suspension. Earlier stream events do not repeat, and completed tools do not run again.
