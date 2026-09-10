---
'@mastra/inngest': patch
---

Inngest durable agent runs now record their spans the same way core does. Token usage moves from the model span's `output` onto its `attributes`, where every other model span reports it, so trace viewers show usage for Inngest agents. The agent span records the final text only; usage and steps remain on the run result.
