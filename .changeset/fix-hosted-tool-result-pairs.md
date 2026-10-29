---
'@mastra/core': patch
---

Fixed orphaned tool results causing requests to fail when switching model providers after hosted tool calls. Matching calls and results are now removed together from outgoing history. Fixes [#28190](https://github.com/mastra-ai/mastra/issues/28190).
