---
'@mastra/core': minor
---

`Session.abort()` now takes an optional `reason`. When a run is stopped with a reason, its `agent_end` event reports it as `abortReason`. Hosts can use this to tell a person pressing Stop apart from other aborts, such as a server restart. An abort without a reason reports nothing, as before, and the reason never carries over to a later run.

```ts
import { USER_STOP_ABORT_REASON } from '@mastra/core/agent-controller';

session.abort({ reason: USER_STOP_ABORT_REASON });

session.subscribe(event => {
  if (event.type === 'agent_end' && event.abortReason === USER_STOP_ABORT_REASON) {
    // A person stopped this run on purpose.
  }
});
```
