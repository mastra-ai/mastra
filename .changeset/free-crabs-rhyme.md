---
'@mastra/core': patch
---

Fixed an earlier assistant reply being pulled into the current turn when a state signal was added at the start of a run. Output processors and scorers now only see this turn's response, earlier saved replies are no longer saved again, and the new response still gets its own message after the earlier reply. Fixes [#28565](https://github.com/mastra-ai/mastra/issues/28565).
