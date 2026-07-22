---
'@mastra/core': patch
---

Improve stored `runEvals` per-turn scores (follow-up to multi-turn `turns`). Each persisted per-turn scorer/gate result is now labeled with its turn index (`metadata.turnIndex`), carries the conversation's shared `threadId`, and links to that turn's own trace span instead of the item-level span. This lets the scores UI group and label per-turn scores by conversation and turn, and resolve each score to the correct trace.
