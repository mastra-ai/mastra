---
'@mastra/inngest': patch
---

Fixed Inngest durable agents ending the agent run and model generation spans on the default observability config when a `configSelector` picked a different one. The spans now end on the config they started on.
