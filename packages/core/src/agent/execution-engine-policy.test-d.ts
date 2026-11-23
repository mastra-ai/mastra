import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import type { MastraModelOutput } from '../stream/base/output';
import type { ShouldPersistSnapshotFn } from '../workflows/types';
import { Agent } from './agent';
import type { AgentStreamOutput } from './agent.types';
import type { AgentStreamsConfig } from './streams/types';

const config = { id: 'policy', name: 'Policy', instructions: 'Help the user.', model: 'openai/gpt-4o' } as const;

describe('execution engine configuration contracts', () => {
  it('preserves call-specific structured output inference for native engines', async () => {
    for (const executionEngine of ['default', 'evented', false] as const) {
      const agent = new Agent({ ...config, durable: { executionEngine } });
      const schema = z.object({ status: z.string() });
      const streamed = await agent.stream('Check my order', { structuredOutput: { schema } });
      expectTypeOf(await streamed.object).toEqualTypeOf<{ status: string }>();
      // The public return type stays MastraModelOutput so Agent subclasses keep compiling.
      expectTypeOf(streamed).toEqualTypeOf<MastraModelOutput<{ status: string }>>();
      // Durable lifecycle controls are reached by narrowing to AgentStreamOutput.
      const lifecycle: AgentStreamOutput<{ status: string }> = streamed;
      expectTypeOf(lifecycle.abort).toEqualTypeOf<((reason?: unknown) => Promise<void>) | undefined>();
      expectTypeOf(lifecycle.cleanup).toEqualTypeOf<(() => void) | undefined>();
      expectTypeOf(lifecycle.threadId).toEqualTypeOf<string | undefined>();
      expectTypeOf(lifecycle.resourceId).toEqualTypeOf<string | undefined>();
      const generated = await agent.generate('Check my order', { structuredOutput: { schema } });
      expectTypeOf(generated.object).toEqualTypeOf<{ status: string }>();
    }
  });
  it('accepts Agent boolean forms and object policies without accepting Mastra booleans', () => {
    new Agent({ ...config, durable: true });
    new Agent({ ...config, durable: false });
    for (const executionEngine of ['default', 'evented', false] as const) {
      new Agent({ ...config, durable: { executionEngine } });
      new Mastra({ durable: { executionEngine } });
    }
    // @ts-expect-error Mastra defaults must be an object, not a boolean opt-out
    new Mastra({ durable: false });
    // @ts-expect-error Mastra defaults must be an object, not a boolean opt-in
    new Mastra({ durable: true });
    // @ts-expect-error the prerelease 'durable' value was renamed to 'default'
    new Agent({ ...config, durable: { executionEngine: 'durable' } });
    // @ts-expect-error invalid engine literal
    new Mastra({ durable: { executionEngine: 'plain' } });
    // @ts-expect-error shared transport remains a top-level Mastra option
    new Mastra({ durable: { pubsub: {} } });
    // @ts-expect-error shared cache remains a top-level Mastra option
    new Mastra({ durable: { cache: false } });
  });

  it('preserves the workflow persistence callback contract', () => {
    expectTypeOf<AgentStreamsConfig['shouldPersistSnapshot']>().toEqualTypeOf<ShouldPersistSnapshotFn | undefined>();
    const shouldPersistSnapshot: ShouldPersistSnapshotFn = () => true;
    new Agent({ ...config, durable: { shouldPersistSnapshot } });
    new Mastra({ durable: { shouldPersistSnapshot } });
    // @ts-expect-error snapshot persistence is a callback, not a boolean
    new Agent({ ...config, durable: { shouldPersistSnapshot: true } });
  });
});
