---
'@mastra/memory': patch
---

Fixed Anthropic extended-thinking threads with working memory getting stuck on every turn with "thinking blocks in the latest assistant message cannot be modified". Saving messages no longer keeps a thinking-only step behind after hiding its `updateWorkingMemory` call, and the hidden call no longer reappears in later prompts. Fixes [#22798](https://github.com/mastra-ai/mastra/issues/22798).
