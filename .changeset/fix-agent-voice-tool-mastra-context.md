---
"@mastra/core": patch
---

Agent now injects the `mastra` instance into the tool execution context when handing tools to a static voice provider, matching the same injection already done for chat/stream paths. Tools that access `context.mastra` now work correctly over voice (e.g. `GeminiLiveVoice`) without any workarounds.
