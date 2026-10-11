---
'@mastra/core': patch
---

Fixed tool `transform` replacing the saved tool-call arguments with a placeholder. When a tool configures a transform for only some phases, for example `transcript: { output }` to keep a large result out of memory, the other phases are now stored unchanged instead of becoming `{ message: 'Tool input-available payload unavailable' }`. Threads keep the model's real tool inputs, so they can be replayed, including with Anthropic preserved thinking. A configured transform that throws or returns `undefined` still stores the placeholder, and input deltas are still suppressed. Fixes [#26597](https://github.com/mastra-ai/mastra/issues/26597).
