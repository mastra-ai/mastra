import { createAnthropic } from '@ai-sdk/anthropic';
import { stepCountIs } from '@internal/ai-v7';
import { it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Reasoning streamed by the provider reaches the loop output: deltas in order,
 * the thinking signature and redacted thinking preserved as provider metadata,
 * and reasoning sent back on the next turn so the provider can verify it.
 */
describeForAllEngines('AIMock loop scenario: reasoning', engine => {
  const getMock = useLoopScenarioAimock();
  // aimock's journal normalizes Anthropic requests to chat shape and drops thinking
  // blocks, so capture the raw bodies the provider actually sends.
  const rawBodies: any[] = [];
  const anthropic = () =>
    createAnthropic({
      apiKey: 'aimock-test-key',
      baseURL: `${getMock().url.replace(/\/+$/, '')}/v1`,
      fetch: async (url, init) => {
        if (typeof init?.body === 'string') rawBodies.push(JSON.parse(init.body));
        return fetch(url, init);
      },
    })('claude-sonnet-4-5');

  it('streams reasoning deltas with signature and redacted thinking', async () => {
    const reasoning = 'I will open the conversation with witty banter.';
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      model: anthropic,
      prompt: 'Say hi.',
      stopWhen: stepCountIs(1),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { userMessage: 'Say hi.' },
          {
            content: 'Hi there!',
            reasoning,
            reasoningSignature: 'sig-1234567890',
            redactedThinking: ['redacted-reasoning-data'],
          },
        );
      },
    });

    expect(await output.text).toBe('Hi there!');
    expect(await output.reasoningText).toContain(reasoning);

    const deltas = chunks!.filter(c => c.type === 'reasoning-delta').map(c => c.payload.text);
    expect(deltas.join('')).toContain(reasoning);

    const serialized = JSON.stringify(await output.reasoning);
    expect(serialized).toContain('sig-1234567890');
    expect(serialized).toContain('redacted-reasoning-data');

    // Reasoning comes before the answer text.
    const types = chunks!.map(c => c.type);
    expect(types.indexOf('reasoning-delta')).toBeLessThan(types.indexOf('text-delta'));
  });

  it('sends signed reasoning back to the provider on the next step', async () => {
    rawBodies.length = 0;
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      model: anthropic,
      prompt: 'Look up alpha.',
      tools: {
        lookup: {
          description: 'Looks up a key',
          inputSchema: (await import('@internal/ai-v7')).jsonSchema({
            type: 'object',
            properties: { key: { type: 'string' } },
            required: ['key'],
          }),
          execute: async ({ key }: { key: string }) => ({ value: `VALUE_${key}` }),
        },
      },
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        llm.on(
          { hasToolResult: false },
          {
            reasoning: 'Need to look it up.',
            reasoningSignature: 'sig-step-1',
            toolCalls: [{ id: 'toolu_1', name: 'lookup', arguments: { key: 'alpha' } }],
          },
        );
        llm.on({ hasToolResult: true }, { content: 'alpha is VALUE_alpha' });
      },
    });

    expect(requests.length).toBeGreaterThanOrEqual(2);
    const assistant = rawBodies[1].messages.find((m: any) => m.role === 'assistant');
    expect(assistant.content[0]).toMatchObject({
      type: 'thinking',
      thinking: 'Need to look it up.',
      signature: 'sig-step-1',
    });
  });
});
