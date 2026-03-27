---
'@mastra/memory': patch
'@mastra/core': patch
---

Added concise continuation history for observational memory activation.

When observational memory removes recently processed messages from direct context, the continuation message now carries a compact recent-history block instead of putting that summary into the system message. This keeps the preserved context closer to the user turn it summarizes and avoids blending it into the actor instructions.
