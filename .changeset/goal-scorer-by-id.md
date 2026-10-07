---
'@mastra/core': patch
---

Fixed `goal.scorer` so a string resolves a registered scorer by its id, as documented. Previously it was looked up by registration key, so a scorer registered as `scorers: { testsPass }` with id `tests-pass` failed with "Scorer with tests-pass not found" and paused the goal. Registration keys still work as a fallback.
