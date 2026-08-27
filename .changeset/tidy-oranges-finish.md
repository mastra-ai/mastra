---
'@mastra/inngest': patch
---

Fixed Inngest durable agent finalization hanging before persistence by avoiding nested step tooling inside the already-durable `map-final-output` mapping.
