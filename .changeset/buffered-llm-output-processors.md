---
'@mastra/core': patch
---

Added `bufferSize` option to `SystemPromptScrubber` and `ModerationProcessor`. Set `bufferSize: 200` to check per sentence instead of per chunk (fewer LLM calls, catches content split across chunks). Default unchanged; will become the default in a future major.

```ts
new SystemPromptScrubber({ model, bufferSize: 200 })
new ModerationProcessor({ model, bufferSize: 200 })
```
