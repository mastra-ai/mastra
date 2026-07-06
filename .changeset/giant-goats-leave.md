---
'@mastra/memory': minor
'@mastra/livekit': patch
---

Added a `force` option to `ObservationalMemory.observe()` that bypasses the observation token threshold, so you can distill a conversation on demand — for example once at the end of a short voice call that never accumulated enough unobserved tokens to trigger observation on its own. A forced call with nothing left to observe is still a no-op, so it never runs the observer model on an empty conversation.

```ts
// e.g. in an end-of-call or end-of-session hook
const om = await memory.omEngine;
await om?.observe({ threadId, resourceId, force: true });
```

This pairs with a high inline `observation.messageTokens` threshold: keep observation off the hot path during the conversation, then guarantee one distillation when it ends.
