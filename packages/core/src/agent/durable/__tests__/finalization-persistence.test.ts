import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

describe('durable finalization persistence', () => {
  const instances: Mastra[] = [];
  const transports: EventEmitterPubSub[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    globalRunRegistry.clear();
    for (const mastra of instances.splice(0)) await mastra.shutdown();
    for (const pubsub of transports.splice(0)) await pubsub.close();
  });

  it('reports save failure and resumes finalization after registry cleanup without rerunning tools', async () => {
    const storage = new InMemoryStore();
    const memoryStorage = new InMemoryStore();
    const memoryStore = await memoryStorage.getStore('memory');
    const workflowStore = await storage.getStore('workflows');
    if (!memoryStore || !workflowStore) throw new Error('Required test stores are missing');
    const saveMessages = memoryStore.saveMessages.bind(memoryStore);
    let rejectAssistantSaves = true;
    vi.spyOn(memoryStore, 'saveMessages').mockImplementation(async args => {
      if (rejectAssistantSaves && args.messages.some(message => message.role === 'assistant')) {
        throw new Error('Permanent message storage failure');
      }
      return saveMessages(args);
    });

    let modelCalls = 0;
    const execute = vi.fn(async () => ({ saved: true }));
    function buildAgent() {
      const pubsub = new EventEmitterPubSub();
      transports.push(pubsub);
      const model = new MockLanguageModelV2({
        doStream: async () => {
          modelCalls++;
          const parts: LanguageModelV2StreamPart[] =
            modelCalls === 1
              ? [{ type: 'tool-call', toolCallId: 'write-1', toolName: 'writeRecord', input: '{}' }]
              : [
                  { type: 'text-start', id: 'answer' },
                  { type: 'text-delta', id: 'answer', delta: 'The record was written.' },
                  { type: 'text-end', id: 'answer' },
                ];
          return {
            stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
              { type: 'stream-start', warnings: [] },
              ...parts,
              {
                type: 'finish',
                finishReason: modelCalls === 1 ? 'tool-calls' : 'stop',
                usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
              },
            ]),
          };
        },
      });
      const base = new Agent({
        id: 'save-retry-agent',
        name: 'Save retry agent',
        instructions: 'Write a record and confirm it.',
        model,
        memory: new MockMemory({ storage: memoryStorage }),
        tools: {
          writeRecord: createTool({
            id: 'writeRecord',
            description: 'Write a record',
            inputSchema: z.object({}),
            execute,
          }),
        },
      });
      const agent = createDurableAgent({ agent: base, pubsub });
      instances.push(new Mastra({ agents: { agent }, storage, logger: false }));
      return agent;
    }

    const agent = buildAgent();
    const onFinish = vi.fn();
    const onError = vi.fn();
    const first = await agent.stream('Write the record', {
      memory: { thread: 'thread-1', resource: 'resource-1' },
      onFinish,
      onError,
    });
    await first.output.consumeStream();
    await vi.waitFor(async () => {
      const run = await workflowStore.getWorkflowRunById({
        runId: first.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      expect(run?.snapshot).toMatchObject({ status: 'suspended' });
      expect(JSON.stringify(run?.snapshot)).toContain('The record was written.');
    });
    expect(onFinish).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ error: expect.objectContaining({ name: 'DurableFinishError' }) });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(modelCalls).toBe(2);

    // Drop every process-local run handle and replay topic before resuming.
    first.cleanup();
    globalRunRegistry.delete(first.runId);
    rejectAssistantSaves = false;
    const resumedAgent = buildAgent();
    const result = await resumedAgent.resumeGenerate(first.runId, undefined);
    expect(result.finishReason).toBe('stop');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(modelCalls).toBe(2);
    const history = await memoryStore.listMessages({ threadId: 'thread-1', perPage: false });
    expect(JSON.stringify(history.messages)).toContain('The record was written.');
    expect(new Set(history.messages.map(message => message.id)).size).toBe(history.messages.length);
  });
});
