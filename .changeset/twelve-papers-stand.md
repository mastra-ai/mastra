---
'@mastra/core': patch
---

Fixed background tasks on durable agents with memory failing with "could not verify that this execution still owns the run" when they suspend after the agent's run has finished. The task is now marked suspended and can be resumed with `backgroundTaskManager.resume()`. This covers tools that call `suspend()` and sub-agents that reach a tool needing approval. Fixes [#30182](https://github.com/mastra-ai/mastra/issues/30182).
