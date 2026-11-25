---
'@mastra/core': patch
---

Fixed an earlier assistant reply being pulled into the current turn when a state signal was added at the start of a run. Output processors and scorers now only see this turn's response, and earlier saved replies are no longer changed. Fixes [#28565](https://github.com/mastra-ai/mastra/issues/28565).
