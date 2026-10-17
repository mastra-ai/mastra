import { stepCountIs } from '@internal/ai-v7';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: what the loop does with a tool's result.
 *
 * - `toModelOutput` replaces the raw result in the next model request.
 * - `stopWhen` sees the step's tool results.
 * - A thrown tool error is streamed as a `tool-error` chunk.
 */
describeForAllEngines('AIMock loop scenario: tool results in the loop', engine => {
  const getMock = useLoopScenarioAimock();

  const scriptLookup = (llm: any, finalText: string) => {
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: { q: 'mastra' } }] },
    );
    llm.on({ endpoint: 'chat', toolCallId: 'call_lookup', hasToolResult: true }, { content: finalText });
  };

  it('sends the toModelOutput result, not the raw result, to the next request', async () => {
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up.',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => ({ secret: 'RAW_RESULT' }),
      toModelOutput: () => ({ type: 'text' as const, value: 'TRANSFORMED_RESULT' }),
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Look up mastra.',
      tools: { lookup },
      stopWhen: stepCountIs(3),
      fixtures: llm => scriptLookup(llm, 'Done.'),
    });

    expect(await output.text).toBe('Done.');
    const next = JSON.stringify(requests[1]?.body?.messages ?? []);
    expect(next).toContain('TRANSFORMED_RESULT');
    expect(next).not.toContain('RAW_RESULT');
  });

  it('passes tool results to stopWhen', async () => {
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up.',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => ({ answer: 42 }),
    });
    const seen: any[] = [];

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Look up mastra.',
      tools: { lookup },
      stopWhen: ({ steps }: { steps: any[] }) => {
        seen.push(steps.at(-1)?.toolResults ?? []);
        return steps.length >= 3;
      },
      fixtures: llm => scriptLookup(llm, 'Done.'),
    });

    await output.consumeStream();
    const withResults = seen.find(r => r.length > 0);
    expect(withResults?.[0]).toMatchObject({ toolCallId: 'call_lookup', toolName: 'lookup' });
    expect(JSON.stringify(withResults?.[0])).toContain('42');
  });

  it('streams a thrown tool error as a tool-error chunk', async () => {
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up.',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => {
        throw new Error('lookup exploded');
      },
    });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Look up mastra.',
      tools: { lookup },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm => scriptLookup(llm, 'It failed.'),
    });

    const toolError = chunks.find((c: any) => c.type === 'tool-error');
    expect(toolError?.payload).toMatchObject({ toolCallId: 'call_lookup', toolName: 'lookup' });
    expect(JSON.stringify(toolError?.payload)).toContain('lookup exploded');
  });
});
