import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { createTool } from '../../tools';
import { TokenLimiterProcessor } from './token-limiter';

// Regression for #24110: the limiter must not drop the current run's tool result between steps.
function setup(toolOutput: string, limiter: TokenLimiterProcessor) {
  let executions = 0;
  const prompts: any[][] = [];
  const lookup = createTool({
    id: 'lookup',
    description: 'Look something up',
    inputSchema: z.object({ q: z.string() }),
    execute: async () => {
      executions++;
      return toolOutput;
    },
  });

  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt as any[]);
      const toolResult = (prompt as any[])
        .flatMap(m => (Array.isArray(m.content) ? m.content : []))
        .find((c: any) => c.type === 'tool-result');
      const chunks: any[] = toolResult
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'answer from tool' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            { type: 'tool-call', toolCallId: `call-${prompts.length}`, toolName: 'lookup', input: '{"q":"x"}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...chunks]),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  });

  const agent = new Agent({
    id: 'limited',
    name: 'limited',
    instructions: 'You are helpful.',
    model: model as any,
    tools: { lookup },
    inputProcessors: [limiter],
  });
  return { agent, prompts, executions: () => executions };
}

describe('TokenLimiterProcessor in the agent loop (#24110)', () => {
  it('lets the model see the current-run tool result instead of looping', async () => {
    const { agent, prompts, executions } = setup('result '.repeat(200), new TokenLimiterProcessor({ limit: 2000 }));
    const result = await (await agent.stream('question', { maxSteps: 5 })).getFullOutput();

    expect(executions()).toBe(1);
    expect(prompts).toHaveLength(2);
    expect(result.text).toBe('answer from tool');
  });

  it('fails loudly instead of silently dropping an oversized current-run tool result', async () => {
    const { agent, prompts, executions } = setup('result '.repeat(3000), new TokenLimiterProcessor({ limit: 2000 }));
    const output = await (await agent.stream('question', { maxSteps: 5 })).getFullOutput();

    expect(executions()).toBe(1);
    expect(prompts).toHaveLength(1);
    expect(output.text).toBe('');
    expect(JSON.stringify(output.tripwire ?? output.error ?? '')).toMatch(/current run's messages/);
  });

  it('sends the model a capped copy when maxToolResultTokens is set', async () => {
    const big = 'result '.repeat(3000);
    const { agent, prompts } = setup(big, new TokenLimiterProcessor({ limit: 2000, maxToolResultTokens: 100 }));
    const result = await (await agent.stream('question', { maxSteps: 5 })).getFullOutput();

    expect(result.text).toBe('answer from tool');
    const sent = JSON.stringify(
      prompts[1]!.flatMap(m => (Array.isArray(m.content) ? m.content : [])).find((c: any) => c.type === 'tool-result'),
    );
    expect(sent).toContain('[truncated: showing 100 of');
    expect(sent.length).toBeLessThan(big.length);
  });
});
