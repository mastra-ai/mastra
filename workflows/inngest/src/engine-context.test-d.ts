import { z } from 'zod';
import { createStep } from './index';

// The Inngest engine hands Inngest's own step tooling to `execute`, so step
// primitives are checked at compile time instead of duck-typed at runtime.
createStep({
  id: 'typed-engine-context',
  inputSchema: z.object({ a: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ engine }) => {
    await engine.step.sendEvent('notify', { name: 'record/updated', data: {} });
    await engine.step.sleep('wait', '1s');
    // @ts-expect-error - unknown step tools must not type-check
    await engine.step.notARealTool('x');
    return { ok: true };
  },
});
