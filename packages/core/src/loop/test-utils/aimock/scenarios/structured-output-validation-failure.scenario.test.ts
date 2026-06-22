import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: structured output schema validation failures.
 *
 * When the model returns JSON that violates the schema, the stream should
 * emit an error chunk with detailed validation information. This pins the
 * error path for structured output validation, ensuring consumers get
 * actionable error messages.
 */
describe('AIMock loop scenario: structured output validation failure', () => {
  const getMock = useLoopScenarioAimock();

  it('emits error chunk with validation details when schema validation fails', async () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
      email: z.string().email(),
    });

    const { chunks } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Extract user data from the text.',
      stopWhen: stepCountIs(1),
      structuredOutput: { schema },
      collectChunks: true,
      fixtures: llm => {
        // Model returns invalid JSON that violates schema constraints
        llm.on({ endpoint: 'chat' }, { content: '{"name":"Jo","age":-5,"email":"invalid"}' });
      },
    });

    // Should have an error chunk with validation details
    const errorChunk = chunks?.find(c => c?.type === 'error');
    expect(errorChunk).toBeDefined();

    const errorMessage = (errorChunk?.payload?.error as Error)?.message || '';
    expect(errorMessage).toContain('Structured output validation failed');

    // Should include field-specific validation errors
    expect(errorMessage).toContain('name');
    expect(errorMessage).toContain('age');
    expect(errorMessage).toContain('email');
  });

  it('successfully parses valid structured output from streaming response', async () => {
    const schema = z.object({
      title: z.string(),
      description: z.string(),
    });

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Generate a product description.',
      stopWhen: stepCountIs(1),
      structuredOutput: { schema },
      fixtures: llm => {
        // Model returns valid JSON
        llm.on({ endpoint: 'chat' }, { content: '{"title":"Product","description":"Great product"}' });
      },
    });

    // Should successfully parse the JSON
    const object = await (output as unknown as { object: Promise<unknown> }).object;
    expect(object).toEqual({
      title: 'Product',
      description: 'Great product',
    });
  });

  it('provides nested field path in validation error', async () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          age: z.number().min(18),
        }),
      }),
    });

    const { chunks } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Extract nested user data.',
      stopWhen: stepCountIs(1),
      structuredOutput: { schema },
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: '{"user":{"profile":{"age":15}}}' });
      },
    });

    const errorChunk = chunks?.find(c => c?.type === 'error');
    expect(errorChunk).toBeDefined();

    const errorMessage = (errorChunk?.payload?.error as Error)?.message || '';
    // Should include the nested path
    expect(errorMessage).toContain('user');
    expect(errorMessage).toContain('profile');
    expect(errorMessage).toContain('age');
  });
});
