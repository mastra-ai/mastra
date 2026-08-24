import { renderHook } from '@testing-library/react';
import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';

import { useScorerSchema } from '../use-scorer-schema';
import { jsonSchemaToZodRuntime } from '@/lib/form/json-schema-to-zod-runtime';

/**
 * These schemas are auto-populated into a dataset's input/groundTruth schema,
 * where they decide which recorded scorer payloads are accepted. The contract
 * worth pinning is what they validate, not how they are spelled — so payloads
 * run through the real converter Studio uses for JSON Schema.
 */
const validator = (schema: JSONSchema7) => {
  const zodSchema = jsonSchemaToZodRuntime(schema as Parameters<typeof jsonSchemaToZodRuntime>[0]);
  return (value: unknown) => zodSchema.safeParse(value).success;
};

const parser = (schema: JSONSchema7) => {
  const zodSchema = jsonSchemaToZodRuntime(schema as Parameters<typeof jsonSchemaToZodRuntime>[0]);
  return (value: unknown) => zodSchema.parse(value);
};

/**
 * Collects every node in the schema tree that declares a `description`, so the
 * assertion is "documentation stays non-empty" rather than a copy of the text.
 */
const describedNodes = (node: unknown, found: JSONSchema7[] = []): JSONSchema7[] => {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    for (const entry of node) describedNodes(entry, found);
    return found;
  }
  const schema = node as JSONSchema7 & Record<string, unknown>;
  if ('description' in schema) found.push(schema);
  for (const value of Object.values(schema)) describedNodes(value, found);
  return found;
};

const schemas = () => renderHook(() => useScorerSchema()).result.current;

const message = (role: string, content: unknown = 'hello') => ({ role, content });

const agentScoringInput = (overrides: Record<string, unknown> = {}) => ({
  input: {
    inputMessages: [message('user')],
    rememberedMessages: [message('assistant')],
    systemMessages: [message('system')],
    taggedSystemMessages: { persona: [message('system')] },
  },
  output: [message('assistant')],
  ...overrides,
});

/**
 * A description is only useful to the model if it is a non-blank string.
 * `not.toBe('')` would also pass for `undefined` or whitespace.
 */
const expectMeaningfulText = (value: unknown) => {
  expect(typeof value).toBe('string');
  expect((value as string).trim().length).toBeGreaterThan(0);
};

describe('useScorerSchema', () => {
  describe('when the caller reads the hook', () => {
    it('resolves immediately with no error', () => {
      const { isLoading, error } = schemas();

      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });
  });

  describe('when validating an agent scorer payload', () => {
    const accepts = () => validator(schemas().agentInputSchema);

    it('accepts a complete scoring input', () => {
      expect(accepts()(agentScoringInput())).toBe(true);
    });

    it('accepts an optional runId', () => {
      expect(accepts()(agentScoringInput({ runId: 'run-1' }))).toBe(true);
    });

    it('rejects a non-string runId', () => {
      expect(accepts()(agentScoringInput({ runId: 42 }))).toBe(false);
    });

    it('accepts free-form additional and request context', () => {
      expect(
        accepts()(agentScoringInput({ additionalContext: { note: 'x' }, requestContext: { tenant: 'acme' } })),
      ).toBe(true);
    });

    it.each(['inputMessages', 'rememberedMessages', 'systemMessages', 'taggedSystemMessages'])(
      'requires %s on the scoring input',
      field => {
        const payload = agentScoringInput();
        delete (payload.input as Record<string, unknown>)[field];

        expect(accepts()(payload)).toBe(false);
      },
    );

    it('rejects a message without a role', () => {
      expect(accepts()(agentScoringInput({ output: [{ content: 'hello' }] }))).toBe(false);
    });

    it('rejects a message without content', () => {
      expect(accepts()(agentScoringInput({ output: [{ role: 'assistant' }] }))).toBe(false);
    });

    it('rejects a role the agent runtime does not know', () => {
      expect(accepts()(agentScoringInput({ output: [message('moderator')] }))).toBe(false);
    });

    it.each(['user', 'assistant', 'system', 'tool'])('accepts the %s role on a message', role => {
      expect(accepts()(agentScoringInput({ output: [message(role)] }))).toBe(true);
    });

    it('only allows the system role in systemMessages', () => {
      const payload = agentScoringInput();
      payload.input.systemMessages = [message('user')];

      expect(accepts()(payload)).toBe(false);
    });

    it('only allows the system role in taggedSystemMessages', () => {
      const payload = agentScoringInput();
      payload.input.taggedSystemMessages = { persona: [message('user')] };

      expect(accepts()(payload)).toBe(false);
    });

    it('rejects tagged system messages that are not arrays', () => {
      const payload = agentScoringInput();
      payload.input.taggedSystemMessages = { persona: message('system') } as never;

      expect(accepts()(payload)).toBe(false);
    });

    it('accepts structured content as an object', () => {
      expect(accepts()(agentScoringInput({ output: [message('assistant', { parts: [] })] }))).toBe(true);
    });

    it('accepts content parts as an array of objects', () => {
      expect(accepts()(agentScoringInput({ output: [message('assistant', [{ type: 'text' }])] }))).toBe(true);
    });

    it('rejects content parts that are not objects', () => {
      expect(accepts()(agentScoringInput({ output: [message('assistant', ['plain'])] }))).toBe(false);
    });

    it('rejects content that is neither string, object nor parts array', () => {
      expect(accepts()(agentScoringInput({ output: [message('assistant', 42)] }))).toBe(false);
    });

    it('rejects an output that is not a list of messages', () => {
      expect(accepts()(agentScoringInput({ output: message('assistant') }))).toBe(false);
    });

    it('keeps every tagged system message bucket', () => {
      const parsed = parser(schemas().agentInputSchema)(agentScoringInput()) as {
        input: { taggedSystemMessages: Record<string, unknown[]> };
      };

      expect(Object.keys(parsed.input.taggedSystemMessages)).toEqual(['persona']);
    });

    it('keeps every field of a free-form context object', () => {
      const parsed = parser(schemas().agentInputSchema)(
        agentScoringInput({ additionalContext: { a: 1, b: { c: 2 } }, requestContext: { tenant: 'acme' } }),
      ) as { additionalContext: Record<string, unknown>; requestContext: Record<string, unknown> };

      expect(parsed.additionalContext).toEqual({ a: 1, b: { c: 2 } });
      expect(parsed.requestContext).toEqual({ tenant: 'acme' });
    });

    it('keeps every documented node in the tree self-describing', () => {
      const nodes = describedNodes(schemas().agentInputSchema);

      expect(nodes.length).toBeGreaterThan(5);
      for (const node of nodes) {
        expectMeaningfulText(node.description);
      }
    });

    it.each(['additionalContext', 'requestContext'])('rejects a non-object %s', field => {
      expect(accepts()(agentScoringInput({ [field]: 'not-an-object' }))).toBe(false);
    });

    it('requires a role on a system message', () => {
      const payload = agentScoringInput();
      payload.input.systemMessages = [{ content: 'be terse' } as never];

      expect(accepts()(payload)).toBe(false);
    });

    it('requires content on a system message', () => {
      const payload = agentScoringInput();
      payload.input.systemMessages = [{ role: 'system' } as never];

      expect(accepts()(payload)).toBe(false);
    });

    it('requires a role on a tagged system message', () => {
      const payload = agentScoringInput();
      payload.input.taggedSystemMessages = { persona: [{ content: 'be terse' } as never] };

      expect(accepts()(payload)).toBe(false);
    });

    it('requires content on a tagged system message', () => {
      const payload = agentScoringInput();
      payload.input.taggedSystemMessages = { persona: [{ role: 'system' } as never] };

      expect(accepts()(payload)).toBe(false);
    });

    it('declares the JSON Schema dialect it is written against', () => {
      const { agentInputSchema } = schemas();

      expectMeaningfulText(agentInputSchema.$schema);
      expectMeaningfulText(agentInputSchema.description);
    });
  });

  describe('when validating a custom scorer payload', () => {
    const accepts = () => validator(schemas().customInputSchema);

    it('accepts any input and output shape', () => {
      expect(accepts()({ input: 'anything', output: 42 })).toBe(true);
      expect(accepts()({ input: { nested: true }, output: [1, 2, 3] })).toBe(true);
    });

    it('accepts an empty payload because nothing is required', () => {
      expect(accepts()({})).toBe(true);
    });

    it('still pins runId to a string', () => {
      expect(accepts()({ runId: 'run-1' })).toBe(true);
      expect(accepts()({ runId: 42 })).toBe(false);
    });

    it('still pins the context fields to objects', () => {
      expect(accepts()({ additionalContext: 'nope' })).toBe(false);
      expect(accepts()({ requestContext: 'nope' })).toBe(false);
    });

    it('keeps a free-form input payload intact', () => {
      const parsed = parser(schemas().customInputSchema)({ input: { a: 1 }, output: { b: 2 } }) as {
        input: unknown;
        output: unknown;
      };

      expect(parsed.input).toEqual({ a: 1 });
      expect(parsed.output).toEqual({ b: 2 });
    });

    it('keeps every documented node in the tree self-describing', () => {
      const nodes = describedNodes(schemas().customInputSchema);

      expect(nodes.length).toBeGreaterThan(5);
      for (const node of nodes) {
        expectMeaningfulText(node.description);
      }
    });

    it('keeps every field of the free-form context objects', () => {
      const parsed = parser(schemas().customInputSchema)({
        additionalContext: { a: 1, b: { c: 2 } },
        requestContext: { tenant: 'acme' },
      }) as { additionalContext: Record<string, unknown>; requestContext: Record<string, unknown> };

      expect(parsed.additionalContext).toEqual({ a: 1, b: { c: 2 } });
      expect(parsed.requestContext).toEqual({ tenant: 'acme' });
    });

    it('declares the JSON Schema dialect it is written against', () => {
      const { customInputSchema } = schemas();

      expectMeaningfulText(customInputSchema.$schema);
      expectMeaningfulText(customInputSchema.description);
    });
  });

  describe('when validating scorer ground truth', () => {
    it('accepts any shape, because ground truth is user-defined', () => {
      const accepts = validator(schemas().outputSchema);

      expect(accepts({ score: 1, reason: 'good' })).toBe(true);
      expect(accepts('just a label')).toBe(true);
      expect(accepts(null)).toBe(true);
    });

    it('stays self-describing in the schema editor', () => {
      const { outputSchema } = schemas();

      expectMeaningfulText(outputSchema.$schema);
      expectMeaningfulText(outputSchema.description);
    });
  });
});
