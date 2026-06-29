import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { OpenAIReasoningSchemaCompatLayer } from './provider-compats/openai-reasoning';
import type { ModelInformation } from './types';

const modelInfo: ModelInformation = {
  provider: 'openai',
  modelId: 'o3-mini',
  supportsStructuredOutputs: true,
};

describe('defaultZodDateHandler (zod v4)', () => {
  const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);

  it('describes a min() bound as "newer than" and a max() bound as "older than"', () => {
    const schema = z.date().min(new Date('2020-01-01')).max(new Date('2030-01-01'));

    const result = layer.defaultZodDateHandler(schema);
    const description = result.description ?? '';

    // z.date().min(d) means the date must be >= d, i.e. newer than d.
    expect(description).toContain('Date must be newer than 2020-01-01T00:00:00.000Z (ISO)');
    // z.date().max(d) means the date must be <= d, i.e. older than d.
    expect(description).toContain('Date must be older than 2030-01-01T00:00:00.000Z (ISO)');

    // The inverted (buggy) descriptions must not appear.
    expect(description).not.toContain('Date must be older than 2020-01-01T00:00:00.000Z (ISO)');
    expect(description).not.toContain('Date must be newer than 2030-01-01T00:00:00.000Z (ISO)');
  });

  it('handles a lower bound only (min)', () => {
    const schema = z.date().min(new Date('2020-01-01'));

    const description = layer.defaultZodDateHandler(schema).description ?? '';

    expect(description).toContain('Date must be newer than 2020-01-01T00:00:00.000Z (ISO)');
    expect(description).not.toContain('older than 2020-01-01T00:00:00.000Z');
  });

  it('handles an upper bound only (max)', () => {
    const schema = z.date().max(new Date('2030-01-01'));

    const description = layer.defaultZodDateHandler(schema).description ?? '';

    expect(description).toContain('Date must be older than 2030-01-01T00:00:00.000Z (ISO)');
    expect(description).not.toContain('newer than 2030-01-01T00:00:00.000Z');
  });
});
