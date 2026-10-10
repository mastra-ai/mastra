---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed durable agents ignoring `structuredOutput.model`. The separate structuring model now runs when the turn finishes, so `output.object` resolves and `metadata.structuredOutput` is saved on the assistant message, matching `Agent`.
