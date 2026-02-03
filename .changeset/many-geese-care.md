---
'@mastra/evals': minor
---

Added getContext hook to hallucination scorer for dynamic context resolution at runtime. This enables live scoring scenarios where context (like tool results) is only available when the scorer runs. Also added extractToolResults utility function to help extract tool results from scorer output.
