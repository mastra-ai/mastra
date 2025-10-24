---
'@mastra/inngest': patch
'@mastra/core': patch
---

Remove waitForEvent from workflows. waitForEvent is now deprecated, please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details on suspend & resume flow.
