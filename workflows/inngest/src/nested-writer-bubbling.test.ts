import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { init } from './index';

afterEach(() => vi.restoreAllMocks());

describe('nested workflow writer bubbling', () => {
  it.each([1, 2])('forwards write and custom chunks through %i nested invocations', async depth => {
    const inngest = new Inngest({ id: 'nested-writer-test' });
    // Only replace the durable transport: each invoke still executes the real
    // workflow handler and engine with a serialized event payload.
    const handlers = new Map<string, (context: any) => Promise<any>>();
    vi.spyOn(inngest, 'createFunction').mockImplementation((config: any, handler: any) => {
      handlers.set(config.id, handler);
      return { id: config.id } as any;
    });
    const publish = vi.spyOn(inngest.realtime, 'publish').mockResolvedValue(undefined);
    const { createWorkflow, createStep } = init(inngest);
    const schema = z.object({ value: z.string() });
    let receivedWhileRunning = false;
    const leaf = createStep({
      id: 'leaf',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData, writer }) => {
        await writer.write({ message: 'nested-write' });
        await writer.custom({ type: 'custom-status', message: 'nested-custom' });
        // Chunks must reach the parent before the child returns its result.
        const parentChunks = publish.mock.calls.filter(([topic]) => topic.channel === 'workflow:parent:parent-run');
        receivedWhileRunning =
          parentChunks.some(([, data]) => (data as any).payload?.output?.message === 'nested-write') &&
          parentChunks.some(([, data]) => (data as any).message === 'nested-custom');
        return inputData;
      },
    });
    let child = createWorkflow({ id: 'child', inputSchema: schema, outputSchema: schema }).then(leaf).commit();
    if (depth === 2) {
      child = createWorkflow({ id: 'middle', inputSchema: schema, outputSchema: schema }).then(child).commit();
    }
    const parent = createWorkflow({ id: 'parent', inputSchema: schema, outputSchema: schema }).then(child).commit();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { parent } });
    parent.__registerMastra(mastra);
    parent.getFunction();
    const step = {
      run: async (_id: string, callback: () => Promise<unknown>) => callback(),
      invoke: async (_id: string, { function: fn, data }: any) =>
        handlers.get(fn.id)!({ event: { data: JSON.parse(JSON.stringify(data)) }, step, attempt: 0 }),
      sendEvent: vi.fn(),
    };
    const result = await handlers.get('workflow.parent')!({
      event: { data: { runId: 'parent-run', inputData: { value: 'ok' } } },
      step,
      attempt: 0,
    });
    expect(result.result.status).toBe('success');
    expect(receivedWhileRunning).toBe(true);
    const chunks = publish.mock.calls
      .filter(([topic]) => topic.channel === 'workflow:parent:parent-run')
      .map(([, data]) => data as any);
    expect(chunks.filter(chunk => chunk.payload?.output?.message === 'nested-write')).toHaveLength(1);
    expect(chunks.filter(chunk => chunk.message === 'nested-custom')).toHaveLength(1);
    expect(chunks.filter(chunk => chunk.type === 'workflow-step-finish' && chunk.payload.id === child.id)).toHaveLength(
      1,
    );
    expect(
      publish.mock.calls.some(
        ([topic, data]) => topic.channel.startsWith('workflow:child:') && (data as any).message === 'nested-custom',
      ),
    ).toBe(true);
  });
});
