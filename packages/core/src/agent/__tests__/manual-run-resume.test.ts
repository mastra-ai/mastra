import { describe, expect, it } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import { simulateReadableStream } from 'ai';
import { z } from 'zod';
import { Agent } from '../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';

describe.each(['stream', 'generate'] as const)('manual run through resume%s', resumeMethod => {
  it('keeps the second tool gated on a fresh Agent without repeating the policy', async () => {
    const storage = new InMemoryStore();
    let effects = 0;
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    };
    const createAgent = (firstStep: number) => {
      let step = firstStep;
      return new Agent({
        id: 'manual-resume-agent',
        name: 'Manual resume',
        instructions: 'Run the action twice.',
        model: new MockLanguageModelV3({
          doStream: async () => {
            const current = step++;
            return {
              stream: simulateReadableStream({
                chunks:
                  current <= 2
                    ? [
                        {
                          type: 'tool-call' as const,
                          toolCallType: 'function' as const,
                          toolCallId: `manual-${current}`,
                          toolName: 'action',
                          input: '{}',
                          providerExecuted: false,
                        },
                        {
                          type: 'finish' as const,
                          finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' },
                          usage,
                        },
                      ]
                    : [
                        { type: 'text-start' as const, id: 'done' },
                        { type: 'text-delta' as const, id: 'done', delta: 'Done.' },
                        { type: 'text-end' as const, id: 'done' },
                        { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: 'stop' }, usage },
                      ],
              }),
            };
          },
          doGenerate: async () => {
            const current = step++;
            return {
              content:
                current <= 2
                  ? [{ type: 'tool-call' as const, toolCallId: `manual-${current}`, toolName: 'action', input: '{}' }]
                  : [{ type: 'text' as const, text: 'Done.' }],
              finishReason: {
                unified: current <= 2 ? ('tool-calls' as const) : ('stop' as const),
                raw: current <= 2 ? 'tool-calls' : 'stop',
              },
              usage,
              warnings: [],
            };
          },
        }),
        tools: {
          action: createTool({
            id: 'action',
            description: 'Count an action.',
            inputSchema: z.object({}),
            execute: async () => ({ effects: ++effects }),
          }),
        },
      });
    };
    const before = createAgent(1);
    const firstMastra = new Mastra({ storage, agents: { before }, logger: false });
    const stream = await before.stream('Run twice.', { toolApprovalPolicy: 'manual', maxSteps: 4 });
    await stream.getFullOutput();
    expect(effects).toBe(0);
    const after = createAgent(2);
    const secondMastra = new Mastra({ storage, agents: { after }, logger: false });
    try {
      const resume = async (toolCallId: string) => {
        const options = { runId: stream.runId, toolCallId, maxSteps: 4, requireToolApproval: false };
        if (resumeMethod === 'generate') return after.resumeGenerate({ approved: true }, options);
        return (await after.resumeStream({ approved: true }, options)).getFullOutput();
      };
      await resume('manual-1');
      expect(effects).toBe(1);
      const parked = await after.listSuspendedRuns();
      expect(parked.runs[0]?.toolCalls).toEqual(
        expect.arrayContaining([expect.objectContaining({ toolCallId: 'manual-2', toolApprovalPolicy: 'manual' })]),
      );
      await resume('manual-2');
      expect(effects).toBe(2);
    } finally {
      await firstMastra.shutdown();
      await secondMastra.shutdown();
    }
  });
});
