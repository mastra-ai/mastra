import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import type { JSONSchema7 } from 'json-schema';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: structured output across schema shapes.
 *
 * Each case drives a single structured-output turn end to end and asserts the
 * parsed `object`, so a regression in how a schema shape is sent to the
 * provider or parsed back (array `elements` unwrapping, plain JSON Schema,
 * empty objects, omitted optionals, unions, or JSON text that arrives with a
 * `tool_calls` finish reason as Bedrock does) fails on every engine.
 */
describeForAllEngines('AIMock loop scenario: structured output schema shapes', engine => {
  const getMock = useLoopScenarioAimock();

  async function runStructured(schema: unknown, content: string, finishReason?: string) {
    const llm = getMock();
    // The Responses API derives the finish reason from the output items, so a
    // text-only `tool_calls` finish is only expressible over Chat Completions.
    const chatModel = finishReason
      ? createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` }).chat(
          SCENARIO_MODEL_ID,
        )
      : undefined;
    const { output } = await runLoopScenario({
      engine,
      llm,
      ...(chatModel ? { model: () => chatModel } : {}),
      prompt: 'Return the structured result.',
      stopWhen: stepCountIs(1),
      structuredOutput: { schema: schema as any },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content, ...(finishReason ? { finishReason } : {}) });
      },
    });
    const object = await (output as unknown as { object: Promise<unknown> }).object;
    return object;
  }

  it('unwraps a top-level array schema from its elements wrapper', async () => {
    const users = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    const object = await runStructured(
      z.array(z.object({ name: z.string(), age: z.number() })),
      JSON.stringify({ elements: users }),
    );

    expect(object).toEqual(users);
  });

  it('parses output for a plain JSON Schema', async () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        winners: {
          type: 'array',
          items: {
            type: 'object',
            properties: { winner: { type: 'string' }, year: { type: 'string' } },
            required: ['winner', 'year'],
            additionalProperties: false,
          },
        },
      },
      required: ['winners'],
      additionalProperties: false,
    };
    const expected = {
      winners: [
        { year: '2012', winner: 'Barack Obama' },
        { year: '2016', winner: 'Donald Trump' },
      ],
    };

    const object = await runStructured(schema, JSON.stringify(expected));

    expect(object).toEqual(expected);
  });

  it('parses an empty object schema', async () => {
    const object = await runStructured(z.object({}), '{}');

    expect(object).toEqual({});
  });

  it('parses output that omits optional fields', async () => {
    const object = await runStructured(
      z.object({ name: z.string(), email: z.string().optional(), age: z.number().optional() }),
      JSON.stringify({ name: 'Alice' }),
    );

    expect(object).toEqual({ name: 'Alice' });
  });

  it('parses the matching branch of a union field', async () => {
    const expected = { result: { type: 'success', data: { id: 123 } } };

    const object = await runStructured(
      z.object({
        result: z.union([
          z.object({ type: z.literal('success'), data: z.object({ id: z.number() }) }),
          z.object({ type: z.literal('error'), message: z.string() }),
        ]),
      }),
      JSON.stringify(expected),
    );

    expect(object).toEqual(expected);
  });

  it('parses JSON text when the provider finishes with tool_calls (Bedrock-style)', async () => {
    const routing = {
      primitiveId: 'weatherAgent',
      primitiveType: 'agent',
      prompt: 'What is the weather?',
      selectionReason: 'Selected for weather info',
    };

    const object = await runStructured(
      z.object({
        primitiveId: z.string(),
        primitiveType: z.string(),
        prompt: z.string(),
        selectionReason: z.string(),
      }),
      JSON.stringify(routing),
      'tool_calls',
    );

    expect(object).toEqual(routing);
  });
});
