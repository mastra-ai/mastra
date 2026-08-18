---
'@mastra/core': minor
---

Made AgentController events serialize to JSON on their own, so what a client receives is exactly what the event type says.

**`AgentControllerDisplayState` now uses plain objects instead of `Map`s**

`JSON.stringify` turns a `Map` into `{}`, so every field below reached browser clients empty and the server had to rebuild them. They are now records, keyed the same way.

```ts
// Before
displayState.activeTools.get(toolCallId)?.status;
displayState.activeTools.size;

// After
displayState.activeTools[toolCallId]?.status;
Object.keys(displayState.activeTools).length;
```

Affected fields: `activeTools`, `toolInputBuffers`, `pendingSuspensions`, `activeSubagents`, `modifiedFiles`.

**Error-carrying events now use `SerializableError`**

`error`, `workspace_error` and `workspace_status_changed` used to declare a plain `Error`, whose `name` and `message` are non-enumerable — JSON sent `{}`. They now declare `SerializableError`, an `Error` that carries `toJSON`. It is still a real `Error` in process, so `.message` and `instanceof` are unchanged; only emitting one needs a wrapper.

```ts
// Before
session.emit({ type: 'error', error: new Error('run failed') });

// After
import { getErrorFromUnknown } from '@mastra/core/error';

session.emit({ type: 'error', error: getErrorFromUnknown('run failed', { serializeStack: false }) });
```

**New: `AgentControllerWireEvent`**

The event union as it arrives on a client after JSON — timestamps as ISO strings, errors as `{ name, message }`. Clients can type their stream handlers from it instead of re-describing the payloads by hand.

```ts
import type { AgentControllerWireEvent } from '@mastra/core/agent-controller';

function onFrame(event: AgentControllerWireEvent) {
  if (event.type === 'thread_created') {
    console.log(event.thread.createdAt); // string, not Date
  }
}
```
