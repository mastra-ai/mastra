import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { createTool } from '../tools';

/**
 * A `tool-call-approval` chunk is a promise to the caller: "this run is
 * suspended and resumable by this toolCallId". It must not be emitted before
 * the suspended snapshot is durable, or a caller that approves immediately
 * (a UI clicking Approve the moment the card renders) races the snapshot write
 * and `approveToolCall()` rejects a genuinely-suspended run with
 * AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED.
 */
describe('suspend announces only after the snapshot is persisted', () => {
  function createModel() {
    let call = 0;
    return {
      specificationVersion: 'v2' as const,
      provider: 'mock',
      modelId: 'mock',
      supportedUrls: {},
      async doStream() {
        call++;
        const isGate = call === 1;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          request: { body: 'INVARIANT' },
          warnings: [],
          stream: new ReadableStream({
            start(c) {
              c.enqueue({ type: 'stream-start', warnings: [] });
              c.enqueue({ type: 'response-metadata', id: `id-${call}`, modelId: 'mock', timestamp: new Date(0) });
              c.enqueue({ type: 'text-start', id: 't1' });
              c.enqueue({ type: 'text-delta', id: 't1', delta: 'x' });
              c.enqueue({ type: 'text-end', id: 't1' });
              if (isGate) {
                c.enqueue({
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'gated',
                  input: JSON.stringify({ n: 1 }),
                });
                c.enqueue({
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
              } else {
                c.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
              }
              c.close();
            },
          }),
        };
      },
    };
  }

  it('persists the suspended snapshot before emitting tool-call-approval', async () => {
    const order: string[] = [];

    const gated = createTool({
      id: 'gated',
      description: 'needs approval',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.string(),
      requireApproval: true,
      execute: async () => 'ok',
    });

    const agent = new Agent({
      id: 'order-agent',
      name: 'Order Agent',
      instructions: 'call the tool',
      model: createModel() as any,
      tools: { gated },
    });

    const mastra = new Mastra({ agents: { agent }, logger: false });

    // Record when the suspended snapshot lands, relative to the chunk.
    //
    // Patch `getStore` rather than the store instance: the engine resolves the
    // workflows store per write, and a store patched after the first resolve is
    // not the object the engine goes on to use.
    const storage = mastra.getStorage() as any;
    const originalGetStore = storage.getStore.bind(storage);
    storage.getStore = async (name: string) => {
      const store = await originalGetStore(name);
      if (name !== 'workflows' || !store || (store as any).__orderPatched) return store;
      const originalPersist = store.persistWorkflowSnapshot.bind(store);
      (store as any).__orderPatched = true;
      store.persistWorkflowSnapshot = async (args: any) => {
        const res = await originalPersist(args);
        if (args?.snapshot?.status === 'suspended') order.push(`persist:${args.workflowName}`);
        return res;
      };
      return store;
    };

    const stream = await agent.stream('go', {
      memory: { thread: 'order-thread', resource: 'order-resource' },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        order.push('emit:tool-call-approval');
        break;
      }
    }

    expect(order).toContain('emit:tool-call-approval');

    const emitIndex = order.indexOf('emit:tool-call-approval');
    const persistedBeforeEmit = order.slice(0, emitIndex).filter(entry => entry.startsWith('persist:'));

    // The suspension must be durable by the time the caller hears about it.
    expect(persistedBeforeEmit.length).toBeGreaterThan(0);
  });
});
