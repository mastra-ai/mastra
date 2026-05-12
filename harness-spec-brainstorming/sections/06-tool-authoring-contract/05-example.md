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

  execute: async (input, context) => {
    const harness = context.requestContext.get('harness') as HarnessRequestContext<{
      counters: Record<string, number>;
    }>;

    let next = 0;
    await harness.setState(prev => {
      const current = prev.counters?.[input.name] ?? 0;
      next = current + 1;
      return { ...prev, counters: { ...prev.counters, [input.name]: next } };
    });

    harness.emitCustomEvent({
      type: 'myorg.counter.bumped',
      payload: { name: input.name, value: next },
    });

    return { value: next };
  },
});
```

The functional `setState` form is the right tool here because the next value depends on current state; §6.2 and §5.8 own the concurrency and atomicity rules.

---
