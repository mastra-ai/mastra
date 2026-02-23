---
'@mastra/core': patch
---

Added `hasJudge` metadata to scorer records so the studio can distinguish code-based scorers (e.g., textual-difference, content-similarity) from LLM-based scorers. This metadata is now included in all four score-saving paths: `runEvals`, scorer hooks, trace scoring, and dataset experiments.
