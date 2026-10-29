---
'@mastra/core': patch
---

Durable, evented and Inngest agents now save messages the same way a normal agent does. They follow the agent's MessageHistory and observational-memory settings when they save the input at the start of a run and when they save the turn at the end.

Behavior changes:

- With history turned off (`lastMessages: false` and no MessageHistory), a run no longer saves its messages.
- With a custom MessageHistory processor, messages go to that processor's store instead of the agent's memory. If the processor has no `persistMessages`, nothing is saved.
- When observational memory is added as a processor, the run no longer saves a second copy to agent memory.
- With `observationalMemory: { enabled: false }`, messages are saved by MessageHistory, the same as with a normal agent.
- If a configured MessageHistory processor throws at the end of a run, the run now fails, as it does with a normal agent. Before, the error was logged and the run reported success even though nothing was saved.

If you relied on a durable agent saving messages with history turned off, turn history back on:

```ts
// Before: durable runs saved messages even with this setting
const memory = new Memory({ options: { lastMessages: false } });

// After: enable history to keep saving messages
const memory = new Memory({ options: { lastMessages: 10 } });
```
