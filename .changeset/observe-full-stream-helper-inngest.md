---
'@mastra/inngest': patch
---

The Inngest durable agent's `observe()` now uses `@mastra/core`'s shared `detachFullStreamOnEnd` helper, so the observer's `fullStream` subscription is released when the stream completes, when a read throws, or when the consumer cancels. Existing behavior is unchanged.
