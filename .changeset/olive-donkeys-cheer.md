---
'@mastra/core': minor
---

Added `AgentControllerWireEvent`: the `AgentControllerEvent` union as it actually arrives on a client, after JSON. `Date`s are ISO strings, `Map`s are plain records, and `Error`s are `{ name, message }`.

Clients reading the controller's SSE stream can type their handlers from this instead of re-describing the reshaped payloads by hand, which is how those copies drifted from the events they mirrored.

```ts
import type { AgentControllerWireEvent } from '@mastra/core/agent-controller';

function onFrame(event: AgentControllerWireEvent) {
  if (event.type === 'thread_created') {
    console.log(event.thread.createdAt); // string, not Date
  }
}
```
