---
'@mastra/core': patch
---

Fix per-step `reasoningText` and `reasoning` accumulating across steps for reasoning models. Each step in a multi-step run now reports only the reasoning produced during that step, matching the existing behavior of the per-step `text` field. Run-level `reasoningText` and `reasoning` remain the full concatenation across all steps.
