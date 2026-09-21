import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

describe('durable completion checkpoint round trips', () => {
  it.each([
    { delayMs: 0, withMemory: false },
    { delayMs: 100, withMemory: false },
    { delayMs: 0, withMemory: true },
    { delayMs: 100, withMemory: true },
  ])('reuses acknowledged results with $delayMs ms latency and memory=$withMemory', async ({ delayMs, withMemory }) => {
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    let completionStartedAt = 0;
    let completionFinishedAt = 0;
    let completionStarted = false;
    let completionFinished = false;
    const writes: Array<{ at: number; steps: Array<[string, string]> }> = [];
    vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (completionStarted && !completionFinished)
        writes.push({
          at: performance.now(),
          steps: Object.entries(args.snapshot.context).map(([id, value]) => [id, value?.status]),
        });
      if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      await persist(args);
    });
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'answer' },
          { type: 'text-delta', id: 'answer', delta: 'Ready.' },
          { type: 'text-end', id: 'answer' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });
    const base = new Agent({
      id: 'checkpoint-proof',
      name: 'Checkpoint proof',
      instructions: 'Answer.',
      model,
      memory: withMemory ? new MockMemory() : undefined,
      outputProcessors: [
        {
          id: 'observer',
          processOutputStep: args => {
            completionStarted = true;
            completionStartedAt = performance.now();
            return args.messages;
          },
          processOutputResult: args => {
            completionFinished = true;
            completionFinishedAt = performance.now();
            return args.messages;
          },
        },
      ],
    });
    const agent = createDurableAgent({ agent: base });
    const mastra = new Mastra({ logger: false, storage, agents: { agent }, recovery: { durableAgents: 'auto' } });
    try {
      const result = await agent.stream(
        'Answer.',
        withMemory ? { memory: { thread: 'checkpoint-thread', resource: 'owner' } } : undefined,
      );
      expect(await result.output.text).toBe('Ready.');
      expect(completionFinished).toBe(true);
      process.stdout.write(
        JSON.stringify({
          delayMs,
          withMemory,
          completionWrites: writes.length,
          completionMs: completionFinishedAt - completionStartedAt,
        }) + '\n',
      );
      expect(writes.length).toBeLessThanOrEqual(13);
      const completions = new Set(
        writes.flatMap(w => w.steps.filter(([, status]) => status === 'success').map(([id]) => id)),
      );
      for (const id of [
        'durable-llm-execution',
        'extract-tool-calls',
        'collect-tool-results',
        'durable-llm-mapping',
        'update-iteration-state',
        'durable-is-task-complete',
        'durable-goal',
      ])
        expect(completions.has(id)).toBe(true);
    } finally {
      await mastra.shutdown();
    }
  });
});
