/**
 * AIMock Scenario: Usage reporting
 *
 * The token counts a provider reports must reach the user unchanged, in the
 * AI SDK v5 shape (`inputTokens` / `outputTokens` / `totalTokens`, no legacy
 * `promptTokens` / `completionTokens`), on every public surface:
 * - `stream()` output usage and the `onFinish` payload
 * - `generate()` FullOutput, together with the generated text
 * - a multi-step run sums the usage of every model call
 *
 * Omitted provider counters are covered by the MockLanguageModel suites in
 * `durable-agent-usage-partial-omission.test.ts` and
 * `durable-agent-usage-unknown.test.ts`: aimock fills omitted counters with 0,
 * so it cannot express "provider did not report this counter".
 */

import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

function tokens(usage: Record<string, unknown> | undefined) {
  return {
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    totalTokens: usage?.totalTokens,
  };
}

describeForAllEngines('AIMock loop scenario: usage reporting', engine => {
  const getMock = useLoopScenarioAimock();

  it('stream() reports provider usage in the v5 shape on the output and in onFinish', async () => {
    const onFinish = vi.fn();
    const { output } = await runLoopScenario({
      llm: getMock(),
      engine,
      prompt: 'Say hello.',
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Hello there.', usage: { input_tokens: 10, output_tokens: 20 } });
      },
      onFinish,
    });

    expect(await output.text).toBe('Hello there.');
    const usage = await output.usage;
    expect(tokens(usage)).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(usage).not.toHaveProperty('promptTokens');
    expect(usage).not.toHaveProperty('completionTokens');

    await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(tokens(onFinish.mock.calls[0]![0].usage)).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
  });

  it('generate() returns the text and provider usage in the v5 shape', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Generated reply.', usage: { input_tokens: 7, output_tokens: 11 } });
    const { agent } = await createSharedAgent(llm, { engine });

    const result = await agent.generate('Say something.', { maxSteps: 5 });

    expect(result.text).toBe('Generated reply.');
    expect(result.finishReason).toBe('stop');
    expect(tokens(result.usage)).toEqual({ inputTokens: 7, outputTokens: 11, totalTokens: 18 });
    expect(result.usage).not.toHaveProperty('promptTokens');
    expect(result.usage).not.toHaveProperty('completionTokens');
    expect(llm.getRequests()[0]!.body!.messages.at(-1)).toMatchObject({ role: 'user', content: 'Say something.' });
  });

  it('a tool step and the final text step add up in output usage and onFinish totalUsage', async () => {
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ q: z.string() }),
      execute: async ({ q }) => ({ found: q }),
    });
    const onFinish = vi.fn();
    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      engine,
      prompt: 'Look up mastra.',
      tools: { lookup },
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: { q: 'mastra' } }],
            usage: { input_tokens: 15, output_tokens: 10 },
          },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Found mastra.', usage: { input_tokens: 10, output_tokens: 20 } },
        );
      },
      onFinish,
    });

    expect(await output.text).toBe('Found mastra.');
    expect(requests).toHaveLength(2);
    expect(requests[1]!.body!.messages.at(-1)).toMatchObject({
      role: 'tool',
      content: JSON.stringify({ found: 'mastra' }),
    });
    expect(tokens(await output.usage)).toEqual({ inputTokens: 25, outputTokens: 30, totalTokens: 55 });

    await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());
    const finish = onFinish.mock.calls[0]![0];
    expect(tokens(finish.totalUsage)).toEqual({ inputTokens: 25, outputTokens: 30, totalTokens: 55 });
    expect(finish.steps.map((step: any) => tokens(step.usage))).toEqual([
      { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
      { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    ]);
  });
});
