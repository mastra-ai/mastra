import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: structured output schema kinds.
 *
 * Structured output accepts Zod schemas (including top-level arrays, which are
 * wrapped in an `elements` object on the wire and unwrapped for the caller) and
 * plain JSON Schema objects. Each kind must produce the parsed object on every engine.
 */
describeForAllEngines('AIMock loop scenario: structured output schema types', engine => {
  const getMock = useLoopScenarioAimock();

  it('unwraps a top-level Zod array schema', async () => {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      errorProcessors: [],
      prompt: 'Give me the winners of 2012 and 2016 US presidential elections',
      stopWhen: stepCountIs(1),
      structuredOutput: { schema: z.array(z.object({ winner: z.string(), year: z.string() })) },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          {
            content: JSON.stringify({
              elements: [
                { winner: 'Barack Obama', year: '2012' },
                { winner: 'Donald Trump', year: '2016' },
              ],
            }),
          },
        );
      },
    });

    const object = await (output as unknown as { object: Promise<unknown> }).object;
    expect(object).toEqual([
      { winner: 'Barack Obama', year: '2012' },
      { winner: 'Donald Trump', year: '2016' },
    ]);
  });

  it('parses output against a JSON Schema object', async () => {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      errorProcessors: [],
      prompt: 'Give me the winners of 2012 and 2016 US presidential elections',
      stopWhen: stepCountIs(1),
      structuredOutput: {
        schema: {
          type: 'object',
          properties: {
            winners: {
              type: 'array',
              items: {
                type: 'object',
                properties: { winner: { type: 'string' }, year: { type: 'string' } },
                required: ['winner', 'year'],
              },
            },
          },
          required: ['winners'],
        },
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { content: JSON.stringify({ winners: [{ winner: 'Barack Obama', year: '2012' }] }) },
        );
      },
    });

    const object = await (output as unknown as { object: Promise<unknown> }).object;
    expect(object).toEqual({ winners: [{ winner: 'Barack Obama', year: '2012' }] });
  });

  it('rejects a JSON Schema value that breaks a string format', async () => {
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      errorProcessors: [],
      prompt: 'When does the conference start?',
      stopWhen: stepCountIs(1),
      collectChunks: true,
      structuredOutput: {
        schema: {
          type: 'object',
          properties: {
            // `date-time` requires a timezone offset, so the fixture below is invalid.
            startsAt: { type: 'string', format: 'date-time' },
          },
          required: ['startsAt'],
        },
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: JSON.stringify({ startsAt: '2024-01-01T10:00:00' }) });
      },
    });

    const errorChunk = chunks?.find((c: any) => c?.type === 'error');
    expect(errorChunk).toBeDefined();
    const message = (errorChunk as any)?.payload?.error?.message ?? '';
    expect(message).toContain('validation failed');
    expect(message).toContain('startsAt');
  });
});
