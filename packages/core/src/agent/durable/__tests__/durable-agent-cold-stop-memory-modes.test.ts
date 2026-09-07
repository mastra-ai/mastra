import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { MastraLanguageModelV2Mock } from '../../../test-utils/llm-mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

describe('cold durable cancellation without message persistence', () => {
  it.each(['no Memory', 'readOnly Memory'] as const)('preserves %s through public abortRunStream', async mode => {
    const storage = new InMemoryStore();
    const threadId = 'cold-stop-memory-mode-thread';
    const resourceId = 'cold-stop-memory-mode-owner';
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network in this test'));
    const execute = vi.fn(async () => 'done');
    const results: Array<{ finishReason: string; totalTokens: number | undefined }> = [];
    let modelCalls = 0;
    const createHost = () => {
      const pubsub = new EventEmitterPubSub();
      const memory = mode === 'readOnly Memory' ? new MockMemory({ storage }) : undefined;
      const agent = createDurableAgent({
        pubsub,
        agent: new Agent({
          id: 'cold-stop-memory-mode-agent',
          name: 'Cold Stop Memory Mode',
          instructions: 'Request approval for action.',
          memory,
          model: new MastraLanguageModelV2Mock({
            doGenerate: async () => {
              modelCalls++;
              throw new Error('Cancellation must not start generation');
            },
            doStream: async () => {
              modelCalls++;
              return {
                stream: new ReadableStream({
                  start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] });
                    controller.enqueue({ type: 'tool-call', toolCallId: 'call-1', toolName: 'action', input: '{}' });
                    controller.enqueue({
                      type: 'finish',
                      finishReason: 'tool-calls',
                      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                    });
                    controller.close();
                  },
                }),
              };
            },
          }),
          tools: {
            action: createTool({ id: 'action', description: 'Local action', inputSchema: z.object({}), execute }),
          },
          outputProcessors: [
            {
              id: 'memory-mode-terminal-observer',
              processOutputResult({ result, messageList }) {
                results.push({ finishReason: result.finishReason, totalTokens: result.usage.totalTokens });
                return messageList;
              },
            },
          ],
        }),
      });
      const mastra = new Mastra({ agents: { agent }, storage, pubsub, workers: false, logger: false });
      return { agent, mastra, pubsub };
    };
    const original = createHost();
    let restored: ReturnType<typeof createHost> | undefined;
    let parked: Awaited<ReturnType<typeof original.agent.stream>> | undefined;
    const memoryStore = (await storage.getStore('memory'))!;
    const workflows = (await storage.getStore('workflows'))!;
    const saveMessages = vi.spyOn(memoryStore, 'saveMessages');
    try {
      parked = await original.agent.stream('Request action approval.', {
        memory: {
          thread: threadId,
          resource: resourceId,
          options: mode === 'readOnly Memory' ? { readOnly: true } : undefined,
        },
        requireToolApproval: true,
      });
      void parked.output.consumeStream().catch(() => undefined);
      const runId = parked.runId;
      await expect
        .poll(async () => (await original.agent.listSuspendedRuns({ threadId, resourceId })).runs.map(run => run.runId))
        .toContain(runId);
      const savedBefore = await workflows.listWorkflowRuns({});
      expect(savedBefore.runs.length).toBeGreaterThan(0);
      expect(modelCalls).toBe(1);
      const writesBeforeStop = saveMessages.mock.calls.length;

      restored = createHost();
      restored.agent.abortRunStream(runId);
      await expect(restored.mastra.shutdown()).resolves.toBeUndefined();

      expect(results).toEqual([{ finishReason: 'abort', totalTokens: 15 }]);
      expect(modelCalls).toBe(1);
      expect(execute).not.toHaveBeenCalled();
      expect(saveMessages).toHaveBeenCalledTimes(writesBeforeStop);
      expect((await workflows.listWorkflowRuns({})).runs).toEqual([]);
      expect(network).not.toHaveBeenCalled();
    } finally {
      parked?.cleanup();
      await original.mastra.stopWorkers();
      await restored?.mastra.stopWorkers();
      await original.pubsub.close();
      await restored?.pubsub.close();
      saveMessages.mockRestore();
      network.mockRestore();
    }
  });
});
