---
'@mastra/memory': minor
---

Added `continuationHints` to observational memory configuration, so an agent that drives its
own control flow can stop memory from proposing what it says next.

`<current-task>` and `<suggested-response>` were always requested and there was no way to turn
them off. A `<suggested-response>` is injected into the agent's context and the continuation
reminder tells the agent to follow it, which makes memory a second controller competing with
the agent's own. Pass `false` to disable both sections, or an object to disable them
individually — keeping `<current-task>` while dropping `<suggested-response>` is the common
case.

```ts
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    observationalMemory: {
      observation: { continuationHints: { suggestedResponse: false } },
      reflection: { continuationHints: false },
    },
  },
});
```

Disabling a section removes it fully: the Observer and Reflector no longer describe or
reference it, and a previously stored hint stops being injected into the agent's context once
both observation and reflection disable it.

Defaults are unchanged — existing configurations keep both sections enabled.
