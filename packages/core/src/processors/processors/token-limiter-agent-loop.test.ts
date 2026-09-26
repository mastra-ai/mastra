import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { TokenLimiterProcessor } from './token-limiter';

// Regression for #24110: the limiter must not drop the current run's tool result between steps.
function setup(
  toolOutput: string,
  limiter: TokenLimiterProcessor,
  registration: { input?: boolean; output?: boolean } = { input: true, output: true },
) {
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
    // maxToolResultTokens only takes effect via processToolResult, which only
    // fires for output processors, so the limiter must be registered on both.
    inputProcessors: registration.input ? [limiter] : [],
    outputProcessors: registration.output ? [limiter] : [],
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

  it('sends the model a capped copy of an oversized tool result instead of dropping it', async () => {
    const big = 'result '.repeat(3000);
    const { agent, prompts, executions } = setup(big, new TokenLimiterProcessor({ limit: 2000, maxToolResultTokens: 100 }));
    const result = await (await agent.stream('question', { maxSteps: 5 })).getFullOutput();

    expect(executions()).toBe(1);
    expect(result.text).toBe('answer from tool');
    const sent = JSON.stringify(
      prompts[1]!.flatMap(m => (Array.isArray(m.content) ? m.content : [])).find((c: any) => c.type === 'tool-result'),
    );
    expect(sent).toMatch(/\[truncated: showing \d+ of [\d,]+ tokens\]/);
    expect(sent.length).toBeLessThan(big.length);
  });

  it('without maxToolResultTokens, an oversized tool result is ordinary trimmable content and can be dropped', async () => {
    const { agent, prompts, executions } = setup('result '.repeat(3000), new TokenLimiterProcessor({ limit: 2000 }));
    const result = await (await agent.stream('question', { maxSteps: 5 })).getFullOutput();

    // No cap set, so nothing protects the oversized result from best-fit trimming: every
    // later prompt has the tool result trimmed back out, so the model never sees it, calls
    // the tool again, and the loop runs to maxSteps with no final answer. This is the
    // original #24110 symptom for callers who don't set maxToolResultTokens; setting it is
    // now the documented remedy (see the previous test).
    expect(executions()).toBe(5);
    expect(prompts).toHaveLength(5);
    expect(result.text).toBe('');
    for (const p of prompts) {
      const hasToolResult = p.some((m: any) => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'tool-result'));
      expect(hasToolResult).toBe(false);
    }
  });

  it('maxToolResultTokens has no effect unless the limiter is also registered as an outputProcessor', async () => {
    const big = 'result '.repeat(3000);
    const { agent, prompts, executions } = setup(big, new TokenLimiterProcessor({ limit: 2000, maxToolResultTokens: 100 }), {
      input: true,
      output: false,
    });
    const result = await (await agent.stream('question', { maxSteps: 5 })).getFullOutput();

    // processToolResult never runs (no outputProcessor registration), so the cap never
    // applies: this reproduces the same uncapped-loop symptom as the "no cap set" test above,
    // even though maxToolResultTokens was configured.
    expect(executions()).toBe(5);
    expect(prompts).toHaveLength(5);
    expect(result.text).toBe('');
  });

  it('caps the tool result in the run it executes, but the next turn recalls the full stored result uncapped', async () => {
    const big = 'result '.repeat(3000);
    let executions = 0;
    const prompts: any[][] = [];
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => {
        executions++;
        return big;
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

    const limiter = new TokenLimiterProcessor({ limit: 8000, maxToolResultTokens: 100 });
    const memory = new Memory({ storage: new InMemoryStore(), options: { lastMessages: 100, generateTitle: false } });
    const agent = new Agent({
      id: 'limited-memory',
      name: 'limited-memory',
      instructions: 'You are helpful.',
      model: model as any,
      tools: { lookup },
      memory,
      inputProcessors: [limiter],
      outputProcessors: [limiter],
    });

    // Turn 1: the tool runs and its oversized result is capped for this run's prompt.
    await (
      await agent.stream('question', { memory: { thread: 'thread', resource: 'resource' }, maxSteps: 5 })
    ).getFullOutput();
    expect(executions).toBe(1);
    const turn1ToolResult = JSON.stringify(
      prompts[1]!.flatMap(m => (Array.isArray(m.content) ? m.content : [])).find((c: any) => c.type === 'tool-result'),
    );
    expect(turn1ToolResult).toMatch(/\[truncated: showing \d+ of [\d,]+ tokens\]/);

    // Turn 2: the tool result is recalled from memory instead of re-executed. maxToolResultTokens
    // only caps at execution time via processToolResult, and MessageHistory strips the truncated
    // copy before persisting, so the recalled prompt carries the full, uncapped result again.
    await (
      await agent.stream('second question', { memory: { thread: 'thread', resource: 'resource' }, maxSteps: 5 })
    ).getFullOutput();
    expect(executions).toBe(1); // tool was not called again; result came from memory
    const turn2Prompt = prompts[prompts.length - 1]!;
    const turn2ToolResult = JSON.stringify(
      turn2Prompt.flatMap(m => (Array.isArray(m.content) ? m.content : [])).find((c: any) => c.type === 'tool-result'),
    );
    expect(turn2ToolResult).not.toMatch(/\[truncated: showing/);
    expect(turn2ToolResult).toContain(big.slice(0, 50));
  });
});
