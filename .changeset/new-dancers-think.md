---
'@mastra/core': minor
---

Added `AgentController#generateThreadTitle()` — name a thread on demand from where its conversation went, with the model and instructions `generateTitle` gives the first-turn namer.

It reads a bounded window of the thread's recent messages and writes the thread row without constructing a `Session`, so a "rename this conversation" action never spins up a workspace or sandbox for a session that is no longer live. A live session lends its agent, request context and event stream, and hears the resulting `thread_title_updated`.

```ts
const title = await controller.generateThreadTitle({
  threadId,
  resourceId,
  // The caller's identity, so model resolution bills their credentials.
  requestContext,
  // Optional: hosts that store the title model themselves pass it here.
  model: ({ requestContext }) => resolveModel(storedModelId, { requestContext }),
});
```
