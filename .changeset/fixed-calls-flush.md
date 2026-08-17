---
'@mastra/core': patch
---

Flush completed server-side tool results in `llm-mapping-step` before bailing for a pending client-side tool in the same step. Mixed execute + client/toolset turns now stream and persist `tool-result` for the finished call instead of leaving it in `call` state. Fixes #21637.
