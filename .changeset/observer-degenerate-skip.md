---
'@mastra/memory': patch
---

Fixed Observational Memory aborting agent runs when the Observer summarizes long or repetitive tool output. Giant single lines are now truncated instead of rejected, runs of short identical lines (e.g. many successful tool calls) no longer trip the degenerate-output check, and if the Observer still loops after its retry, that observation cycle is skipped — the messages stay unobserved for the next cycle — rather than throwing. Fixes #24354.
