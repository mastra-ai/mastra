---
'@mastra/factory': patch
---

Fixed Factory re-entry re-appending the entire skill document on same-stage re-runs (for example a review that re-triggers when a pull request is updated). The session now continues with a compact message that references the already-active skill and carries only the fresh context, instead of re-pasting the full skill body every time — sharply cutting redundant prompt-cache token usage.
