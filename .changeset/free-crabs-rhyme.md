---
'@mastra/core': patch
---

Fixed a previous assistant reply being pulled into the current turn when a state signal (such as working memory) was added at the start of a run. Output processors, scorers, and saved messages now only see this turn's response, so earlier stored replies are no longer modified. Fixes [#28565](https://github.com/mastra-ai/mastra/issues/28565).
