/**
 * A durable agent with crash recovery on persists a `running` snapshot at
 * every step boundary. The provider request echo (full prompt plus every tool
 * schema) is pruned from each step result's top level, but the mapping steps
 * wrap the whole LLM step output under `llmOutput`, which kept two more copies
 * of it per step and re-wrote them on every persist (issue #26462).
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// Stands in for the prompt + tool-schema body a provider echoes back on every
// step. Distinctive so it can be found in the persisted snapshot.
const REQUEST_BODY = `PROVIDER-REQUEST-BODY-${'x'.repeat(2000)}`;
const TOOL_STEPS = 2;

function createToolCallingModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
      const finishWithText = call > TOOL_STEPS;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        request: { body: REQUEST_BODY },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          ...(finishWithText
            ? [
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'done' },
                { type: 'text-end', id: 'text-1' },
              ]
            : [
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: `call-${call}`,
                  toolName: 'noop',
                  input: JSON.stringify({ n: call }),
                  providerExecuted: false,
                },
              ]),
          {
            type: 'finish',
            finishReason: finishWithText ? 'stop' : 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

describe('durable agent running snapshots (issue #26462)', () => {
  it('do not persist the provider request body', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const agent = new Agent({
      id: 'request-echo-agent',
      name: 'request-echo-agent',
      instructions: 'Call the noop tool, then answer.',
      model: createToolCallingModel() as LanguageModelV2,
      tools: {
        noop: createTool({
          id: 'noop',
          description: 'Does nothing.',
          inputSchema: z.object({ n: z.number() }),
          execute,
        }),
      },
    });
    const durableAgent = createDurableAgent({ agent });
    const mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore(),
      agents: { 'request-echo-agent': durableAgent as any },
      recovery: { durableAgents: 'auto' },
    });

    const workflowsStore: any = await mastra.getStorage()!.getStore('workflows');
    const runningSnapshots: string[] = [];
    const originalPersist = workflowsStore.persistWorkflowSnapshot.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
      if (args.snapshot?.status === 'running') runningSnapshots.push(JSON.stringify(args.snapshot));
      return originalPersist(args);
    });
    // Terminal cleanup deletes the run's snapshot rows only after every engine
    // persist for the run, so it marks the point where no more writes can come.
    const deletedRunIds = new Set<string>();
    const originalDelete = workflowsStore.deleteWorkflowRunById.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'deleteWorkflowRunById').mockImplementation(async (args: any) => {
      deletedRunIds.add(args.runId);
      return originalDelete(args);
    });

    const result: any = await durableAgent.stream('go');
    for await (const _ of result.fullStream) {
      // drain the run to completion
    }
    await vi.waitFor(() => expect(deletedRunIds.has(result.runId)).toBe(true), { timeout: 30000 });

    // The run really looped through its tool steps and checkpointed them, so
    // the assertion below cannot pass vacuously.
    expect(execute).toHaveBeenCalledTimes(TOOL_STEPS);
    expect(runningSnapshots.length).toBeGreaterThan(0);
    expect(runningSnapshots.filter(snapshot => snapshot.includes(REQUEST_BODY))).toEqual([]);
  });
});
