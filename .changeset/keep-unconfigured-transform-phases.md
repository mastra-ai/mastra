---
'@mastra/core': patch
---

Fixed saved tool calls losing their original arguments when a tool transforms only its output. Saved threads now keep those arguments for replay, including Anthropic requests with preserved thinking. Fixes [#26597](https://github.com/mastra-ai/mastra/issues/26597).
