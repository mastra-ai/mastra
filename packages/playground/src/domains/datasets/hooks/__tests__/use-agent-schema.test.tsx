import { renderHook } from '@testing-library/react';
import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';

import { useAgentSchema } from '../use-agent-schema';
import { jsonSchemaToZodRuntime } from '@/lib/form/json-schema-to-zod-runtime';

/**
 * These schemas are auto-populated into a dataset's input/groundTruth schema,
 * where they decide which recorded agent payloads are accepted. So the contract
 * worth pinning is what they validate, not how they are spelled — we run the
 * real converter Studio uses for JSON Schema and check payloads through it.
 */
const validator = (schema: JSONSchema7) => {
  const zodSchema = jsonSchemaToZodRuntime(schema as Parameters<typeof jsonSchemaToZodRuntime>[0]);
  return (value: unknown) => zodSchema.safeParse(value).success;
};

const schemas = () => renderHook(() => useAgentSchema()).result.current;

describe('useAgentSchema', () => {
  describe('when the caller reads the hook', () => {
    it('resolves immediately with no error', () => {
      const { isLoading, error } = schemas();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });
  });

  describe('when validating agent input against the input schema', () => {
    const accepts = () => validator(schemas().inputSchema);

    it('accepts a plain text message', () => {
      expect(accepts()('Summarise this thread')).toBe(true);
    });

    it('accepts an array of text messages', () => {
      expect(accepts()(['first', 'second'])).toBe(true);
    });

    it('accepts a single message object', () => {
      expect(accepts()({ role: 'user', content: 'hello' })).toBe(true);
    });

    it('accepts an array of message objects', () => {
      expect(
        accepts()([
          { role: 'system', content: 'be terse' },
          { role: 'assistant', content: 'ok' },
        ]),
      ).toBe(true);
    });

    it('accepts multi-part content', () => {
      expect(accepts()({ role: 'user', content: [{ type: 'text', text: 'hi' }] })).toBe(true);
    });

    it.each(['user', 'assistant', 'system', 'tool'])('accepts the %s role', role => {
      expect(accepts()({ role, content: 'hello' })).toBe(true);
    });

    it('rejects a role the agent runtime does not know', () => {
      expect(accepts()({ role: 'moderator', content: 'hello' })).toBe(false);
    });

    it('rejects a message object without a role', () => {
      expect(accepts()({ content: 'hello' })).toBe(false);
    });

    it('rejects a message object without content', () => {
      expect(accepts()({ role: 'user' })).toBe(false);
    });

    it('rejects content that is neither a string nor a list of parts', () => {
      expect(accepts()({ role: 'user', content: 42 })).toBe(false);
    });

    it('rejects a bare number', () => {
      expect(accepts()(42)).toBe(false);
    });
  });

  describe('when validating agent output against the output schema', () => {
    const accepts = () => validator(schemas().outputSchema);

    it('accepts a full generate() result', () => {
      expect(
        accepts()({
          text: 'the summary',
          object: { any: 'shape' },
          toolCalls: [{ toolName: 'search' }],
          toolResults: [{ result: 'ok' }],
          sources: [{ url: 'https://example.com' }],
          files: [{ name: 'out.txt' }],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          reasoningText: 'because',
        }),
      ).toBe(true);
    });

    it('accepts partial ground truth carrying only text', () => {
      expect(accepts()({ text: 'the summary' })).toBe(true);
    });

    it('accepts an empty result', () => {
      expect(accepts()({})).toBe(true);
    });

    it('rejects a non-string text', () => {
      expect(accepts()({ text: 42 })).toBe(false);
    });

    it('rejects a non-string reasoningText', () => {
      expect(accepts()({ reasoningText: 42 })).toBe(false);
    });

    it.each(['toolCalls', 'toolResults', 'sources', 'files'])('rejects a non-array %s', key => {
      expect(accepts()({ [key]: 'not-a-list' })).toBe(false);
    });

    it.each(['promptTokens', 'completionTokens', 'totalTokens'])('rejects a non-numeric usage.%s', key => {
      expect(accepts()({ usage: { [key]: 'lots' } })).toBe(false);
    });

    it('rejects a non-object usage', () => {
      expect(accepts()({ usage: 15 })).toBe(false);
    });

    it('rejects a top-level value that is not an object', () => {
      expect(accepts()('just text')).toBe(false);
    });
  });
});
