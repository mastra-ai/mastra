---
'@mastra/core': patch
---

Fix empty overrideScorers causing error instead of skipping scoring

When `overrideScorers` was passed as an empty object `{}`, the agent would throw a "No scorers found" error. Now an empty object explicitly skips scoring, while `undefined` continues to use default scorers.

