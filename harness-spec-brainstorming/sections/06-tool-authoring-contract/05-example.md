### 6.5 Example

```ts
import { createTool } from '@mastra/core/tools';
import type { HarnessRequestContext } from '@mastra/core/harness/v1';
import { z } from 'zod';

export const incrementCounter = createTool({
  id: 'increment_counter',
  description: 'Bump a named counter on the session.',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ value: z.number() }),

  execute: async ({ context: input, requestContext }) => {
    const harness = requestContext.get('harness') as HarnessRequestContext<{
      counters: Record<string, number>;
    }>;

    let next = 0;
    await harness.setState(prev => {
      const current = prev.counters?.[input.name] ?? 0;
      next = current + 1;
      return { ...prev, counters: { ...prev.counters, [input.name]: next } };
    });

    harness.emitEvent({
      type: 'myorg.counter.bumped',
      sessionId: harness.sessionId,
      name: input.name,
      value: next,
    });

    return { value: next };
  },
});
```

The functional `setState` form is the right tool here: two parallel `increment_counter` calls under `experimental_parallelToolCalls` would race with the object form, but the functional form linearises through the harness.

---
