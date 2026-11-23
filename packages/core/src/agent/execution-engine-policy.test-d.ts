import { describe, expectTypeOf, it } from 'vitest';
import { Mastra } from '../mastra';
import type { ShouldPersistSnapshotFn } from '../workflows/types';
import { Agent } from './agent';
import type { AgentStreamsConfig } from './streams/types';

const config = { id: 'policy', name: 'Policy', instructions: 'Help the user.', model: 'openai/gpt-4o' } as const;

describe('execution engine configuration contracts', () => {
  it('accepts Agent boolean forms and object policies without accepting Mastra booleans', () => {
    new Agent({ ...config, durable: true });
    new Agent({ ...config, durable: false });
    for (const executionEngine of ['durable', 'evented', false] as const) {
      new Agent({ ...config, durable: { executionEngine } });
      new Mastra({ durable: { executionEngine } });
    }
    // @ts-expect-error Mastra defaults must be an object, not a boolean opt-out
    new Mastra({ durable: false });
    // @ts-expect-error Mastra defaults must be an object, not a boolean opt-in
    new Mastra({ durable: true });
    // @ts-expect-error internal workflow-engine names are not public policies
    new Agent({ ...config, durable: { executionEngine: 'default' } });
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
