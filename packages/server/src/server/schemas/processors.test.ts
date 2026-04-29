import { describe, expect, it } from 'vitest';
import { executeProcessorBodySchema, executeProcessorResponseSchema } from './processors';

const message = {
  id: 'message-1',
  role: 'user' as const,
  content: {
    format: 2,
    parts: [{ type: 'text', text: 'hello' }],
  },
};

describe('processor schemas', () => {
  it('should reject execute requests with both messages and modelContextMessages', () => {
    const result = executeProcessorBodySchema.safeParse({
      phase: 'input',
      messages: [message],
      modelContextMessages: [message],
    });

    expect(result.success).toBe(false);
  });

  it('should accept execute requests with modelContextMessages only', () => {
    const result = executeProcessorBodySchema.safeParse({
      phase: 'input',
      modelContextMessages: [message],
    });

    expect(result.success).toBe(true);
  });

  it('should reject execute responses with both messages and modelContextMessages', () => {
    const result = executeProcessorResponseSchema.safeParse({
      success: true,
      phase: 'input',
      messages: [message],
      modelContextMessages: [message],
    });

    expect(result.success).toBe(false);
  });
});
