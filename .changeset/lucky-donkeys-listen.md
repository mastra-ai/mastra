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

Also fixes two prompt bugs this exposed: the Observer and Reflector prompts named
`<current-task>` and `<suggested-response>` in their closing guidance, nesting instruction, and
multi-thread examples unconditionally, even when the output format had already omitted them;
and `buildObserverOutputFormat` treated an empty extractor list as "legacy caller, describe
both sections", which would have silently re-enabled the sections it was asked to drop.

Defaults are unchanged — `buildObserverSystemPrompt()` and `buildReflectorSystemPrompt()` with
no arguments produce byte-identical prompts.
