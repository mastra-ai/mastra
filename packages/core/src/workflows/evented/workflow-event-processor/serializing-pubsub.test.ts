import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import type { Workflow } from '../..';
import type { PubSub } from '../../../events';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';

/**
 * Models any real broker (Redis Streams, Valkey, GCP Pub/Sub): events are JSON
 * round-tripped on publish, so functions (e.g. a loop `condition`) are dropped
 * from the payload. `EventEmitterPubSub` passes objects by reference and hides
 * this class of bug. See https://github.com/mastra-ai/mastra/issues/23111.
 */
class SerializingPubSub extends EventEmitterPubSub {
  async publish(topic: string, event: any) {
    return super.publish(topic, JSON.parse(JSON.stringify(event)));
  }
}

async function runWorkflow(
  entry: Workflow,
  workflows: Record<string, Workflow>,
  pubsub: PubSub = new SerializingPubSub(),
) {
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows,
    pubsub,
  });
  await mastra.startWorkers();
  try {
    const run = await entry.createRun();
    const stream = run.stream({ inputData: {} });
    for await (const _chunk of stream.fullStream) {
      // drain
    }
    return await stream.result;
  } finally {
    await mastra.stopWorkers();
  }
}

function createInnerWorkflow(execute: () => Promise<any>) {
  return createWorkflow({ id: 'inner_stage', inputSchema: z.any(), outputSchema: z.any() })
    .then(createStep({ id: 'inner_step', inputSchema: z.any(), outputSchema: z.any(), execute }))
    .commit();
}

describe('evented workflows over a serializing pubsub', () => {
  it('dountil over a nested workflow evaluates the loop condition', async () => {
    const inner = createInnerWorkflow(async () => ({ done: true }));
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dountil(inner, async ({ inputData }) => inputData?.done === true)
      .commit();

    const result = await runWorkflow(outer, { outer_loop: outer, inner_stage: inner });

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ done: true });
  });

  it('dountil over a nested workflow loops until the condition is met', async () => {
    let count = 0;
    const execute = vi.fn(async () => ({ count: ++count }));
    const inner = createInnerWorkflow(execute);
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dountil(inner, async ({ inputData }) => inputData?.count >= 2)
      .commit();

    const result = await runWorkflow(outer, { outer_loop: outer, inner_stage: inner });

    expect(result.status).toBe('success');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.status === 'success' && result.result).toEqual({ count: 2 });
  });

  it('dowhile over a nested workflow evaluates the loop condition', async () => {
    const inner = createInnerWorkflow(async () => ({ done: true }));
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dowhile(inner, async ({ inputData }) => inputData?.done !== true)
      .commit();

    const result = await runWorkflow(outer, { outer_loop: outer, inner_stage: inner });

    expect(result.status).toBe('success');
  });

  it('dountil over a nested workflow works when the loop-owning workflow is itself nested', async () => {
    const inner = createInnerWorkflow(async () => ({ done: true }));
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dountil(inner, async ({ inputData }) => inputData?.done === true)
      .commit();
    const root = createWorkflow({ id: 'root', inputSchema: z.any(), outputSchema: z.any() }).then(outer).commit();

    const result = await runWorkflow(root, { root, outer_loop: outer, inner_stage: inner });

    expect(result.status).toBe('success');
  });

  // Control: the same workflow on the by-reference pubsub must keep working —
  // guards against the live-registry resolution regressing the in-memory path.
  it('dountil over a nested workflow still works on the plain EventEmitterPubSub', async () => {
    const inner = createInnerWorkflow(async () => ({ done: true }));
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dountil(inner, async ({ inputData }) => inputData?.done === true)
      .commit();

    const result = await runWorkflow(outer, { outer_loop: outer, inner_stage: inner }, new EventEmitterPubSub());

    expect(result.status).toBe('success');
  });
});
