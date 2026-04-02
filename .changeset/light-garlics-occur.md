---
'@mastra/ai-sdk': patch
---

Fixed nested-agent streaming payload growth that could exhaust memory and crash Node in multi-step runs. Resolves #14932.
