---
'@mastra/client-js': minor
---

Added `isKnownAgentControllerEvent` to narrow agent controller stream events. `AgentControllerEvent` includes a forward-compatibility arm whose `type` is `string`, so comparing `event.type` to a literal never narrows the union and payload fields stay `unknown` — consumers had to cast.

**Before**

```ts
session.subscribe({
  onEvent: event => {
    const known = event as KnownAgentControllerEvent;
    if (known.type === 'message_end') save(known.message);
  },
});
```

**After**

```ts
import { isKnownAgentControllerEvent } from '@mastra/client-js';

session.subscribe({
  onEvent: event => {
    if (isKnownAgentControllerEvent(event) && event.type === 'message_end') save(event.message);
  },
});
```

The guard is kept in sync with the event union at compile time, so a new event type cannot be added without it.
