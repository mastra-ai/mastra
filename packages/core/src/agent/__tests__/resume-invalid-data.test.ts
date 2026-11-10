import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function createModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const parts: any[] =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'ask', input: '{}', providerExecuted: false },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts]),
      };
    },
  });
}

function createAsk() {
  return createTool({
    id: 'ask',
    description: 'Ask a person',
    inputSchema: z.object({}),
    resumeSchema: z.object({ answer: z.string() }),
    execute: async (_input, { agent }) => {
      if (!agent?.resumeData) return agent!.suspend({ question: 'which one?' });
      return { answer: (agent.resumeData as { answer: string }).answer };
    },
  });
}

function setup(tools: Record<string, any> = { ask: createAsk() }) {
  const agent = new Agent({ id: 'asker', name: 'asker', instructions: 'ask', model: createModel(), tools });
  new Mastra({ agents: { asker: agent }, storage: new InMemoryStore(), logger: false });
  return agent;
}

describe('resume with data that fails the tool resumeSchema', () => {
  for (const method of ['resumeGenerate', 'resumeStream'] as const) {
    it(`${method}() rejects and leaves the run suspended`, async () => {
      const agent = setup();
      const first = await (await agent.stream('go')).getFullOutput();
      expect(first.finishReason).toBe('suspended');
      const runId = first.runId!;

      await expect(
        method === 'resumeStream'
          ? agent.resumeStream({ nope: 1 }, { runId }).then(s => s.getFullOutput())
          : agent.resumeGenerate({ nope: 1 }, { runId }),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_INVALID_DATA' });
      expect((await agent.listSuspendedRuns()).total).toBe(1);

      const resumed = await (await agent.resumeStream({ answer: 'the blue one' }, { runId })).getFullOutput();
      expect(resumed.text).toBe('done');
    });
  }

  it('validates a tool passed through toolsets', async () => {
    const agent = setup({});
    const toolsets = { extra: { ask: createAsk() } };
    const first = await (await agent.stream('go', { toolsets })).getFullOutput();
    expect(first.finishReason).toBe('suspended');
    const runId = first.runId!;

    await expect(agent.resumeGenerate({ nope: 1 }, { runId, toolsets })).rejects.toMatchObject({
      id: 'AGENT_RESUME_INVALID_DATA',
    });
    expect((await agent.listSuspendedRuns()).total).toBe(1);
  });
});
