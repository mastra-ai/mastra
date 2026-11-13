---
'@mastra/code-sdk': patch
---

Stop registering the built-in outcome and efficiency scorers on every Mastra Code session. No scorers run by default; pass `scorers` to `createMastraCode` to opt into evaluation. Existing `@mastra/code-sdk/evals` exports and `disableScoreStorage` remain available.
