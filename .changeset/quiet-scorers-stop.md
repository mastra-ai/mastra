---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Stop running unused outcome and efficiency scorers in Mastra Code sessions. The scorer results were not consumed; the SDK no longer exports `@mastra/code-sdk/evals` or accepts `disableScoreStorage`, and the Factory no longer accepts `disableScoreStorage`. Remove that option from callers when upgrading.
