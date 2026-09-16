---
'@mastra/factory': patch
---

Fixed Factory re-entry re-appending the entire skill document on same-stage re-runs. This happened, for example, when a review re-triggered as a pull request was updated. The session now continues with a compact message that references the already-active skill and carries only the fresh context. This avoids re-pasting the full skill body every time and sharply cuts redundant prompt-cache token usage.
