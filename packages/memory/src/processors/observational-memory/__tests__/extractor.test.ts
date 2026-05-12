import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import {
  BUILT_IN_EXTRACTOR_SLUGS,
  Extractor,
  buildExtractorOutputSections,
  buildExtractorPriorLines,
  getExtractedValueForExtractor,
  invokeExtractorHooks,
  isBuiltInExtractorSlug,
  parseExtractedValues,
  slugifyExtractorName,
  stripExtractorSections,
  validateExtractorList,
} from '../extractor';

const mainAgent = new Agent({
  id: 'agent-1',
  name: 'Main Agent',
  instructions: 'Test agent',
  model: new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text: 'ok' }],
      warnings: [],
    }),
  }),
});
const requestContext = new RequestContext();
const observedMessages = [
  {
    id: 'message-1',
    threadId: 't1',
    resourceId: 'r1',
    role: 'user' as const,
    content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'billing question' }] },
    createdAt: new Date(),
  },
];
const observerHookContext = {
  source: 'observer' as const,
  observations: {
    observedMessages,
    activeObservations: 'Date: yesterday\n* Prior observation',
    newObservations: 'Date: today\n* New observation',
  },
};
const reflectorHookContext = {
  source: 'reflector' as const,
  observations: {
    activeObservations: 'Date: yesterday\n* Prior observation',
    newObservations: 'Date: today\n* Reflected observation',
  },
};

describe('Extractor public API', () => {
  describe('slugifyExtractorName', () => {
    it('lowercases and hyphenates', () => {
      expect(slugifyExtractorName('Follows Policy')).toBe('follows-policy');
    });

    it('collapses runs of non-alphanumerics and trims leading/trailing dashes', () => {
      expect(slugifyExtractorName('  __User Profile!! 42 __')).toBe('user-profile-42');
    });

    it('returns empty string when no alphanumerics are present', () => {
      expect(slugifyExtractorName('!!!')).toBe('');
    });
  });

  describe('isBuiltInExtractorSlug', () => {
    it('recognizes the built-in slugs', () => {
      expect(isBuiltInExtractorSlug('thread-title')).toBe(true);
      expect(isBuiltInExtractorSlug('current-task')).toBe(true);
      expect(isBuiltInExtractorSlug('suggested-response')).toBe(true);
    });

    it('returns false for arbitrary slugs', () => {
      expect(isBuiltInExtractorSlug('follows-policy')).toBe(false);
    });
  });

  describe('Extractor constructor', () => {
    it('slugifies name and applies defaults', () => {
      const ext = new Extractor({
        name: 'Follows Policy',
        instructions: 'Output "ok" or describe the violation.',
      });
      expect(ext.name).toBe('Follows Policy');
      expect(ext.slug).toBe('follows-policy');
      expect(ext.injectionBehaviour).toBe('none');
      // schema defaults to z.string()
      expect(ext.schema.parse('hello')).toBe('hello');
    });

    it('throws on empty name', () => {
      expect(() => new Extractor({ name: '   ', instructions: 'x' })).toThrow(/Extractor\.name is required/);
    });

    it('throws when name slugifies to empty', () => {
      expect(() => new Extractor({ name: '!!!', instructions: 'x' })).toThrow(/slugifies to an empty string/);
    });

    it('throws on empty instructions', () => {
      expect(() => new Extractor({ name: 'foo', instructions: '   ' })).toThrow(/requires non-empty instructions/);
    });

    it('accepts custom injectionBehaviour and onExtracted hook', () => {
      const hook = vi.fn();
      const ext = new Extractor({
        name: 'foo',
        instructions: 'do thing',
        injectionBehaviour: 'carry-forward',
        onExtracted: hook,
      });
      expect(ext.injectionBehaviour).toBe('carry-forward');
      expect(ext.onExtracted).toBe(hook);
    });
  });

  describe('Extractor built-in factories', () => {
    it('threadTitle uses the built-in slug and carry-forward', () => {
      const ext = Extractor.threadTitle();
      expect(ext.slug).toBe(BUILT_IN_EXTRACTOR_SLUGS.threadTitle);
      expect(ext.injectionBehaviour).toBe('carry-forward');
    });

    it('currentTask uses the built-in slug', () => {
      const ext = Extractor.currentTask();
      expect(ext.slug).toBe(BUILT_IN_EXTRACTOR_SLUGS.currentTask);
      expect(ext.injectionBehaviour).toBe('carry-forward');
    });

    it('suggestedResponse uses the built-in slug', () => {
      const ext = Extractor.suggestedResponse();
      expect(ext.slug).toBe(BUILT_IN_EXTRACTOR_SLUGS.suggestedResponse);
      expect(ext.injectionBehaviour).toBe('carry-forward');
    });

    it('allows instruction overrides on factories', () => {
      const ext = Extractor.threadTitle({ instructions: 'OVERRIDDEN' });
      expect(ext.instructions).toBe('OVERRIDDEN');
    });
  });

  describe('validateExtractorList', () => {
    it('passes for a clean list', () => {
      expect(() =>
        validateExtractorList(
          [
            new Extractor({ name: 'follows-policy', instructions: 'x' }),
            new Extractor({ name: 'user-profile', instructions: 'x' }),
          ],
          'observer.extract',
        ),
      ).not.toThrow();
    });

    it('allows built-in factories alongside customs', () => {
      expect(() =>
        validateExtractorList(
          [Extractor.threadTitle(), Extractor.currentTask(), new Extractor({ name: 'foo', instructions: 'x' })],
          'observer.extract',
        ),
      ).not.toThrow();
    });

    it('throws when two extractors slugify to the same value', () => {
      expect(() =>
        validateExtractorList(
          [
            new Extractor({ name: 'Follows Policy', instructions: 'x' }),
            new Extractor({ name: 'follows-policy', instructions: 'y' }),
          ],
          'observer.extract',
        ),
      ).toThrow(/both slugify to "follows-policy"/);
    });

    it('throws when a custom name slugifies to a reserved tag', () => {
      expect(() =>
        validateExtractorList([new Extractor({ name: 'Observations', instructions: 'x' })], 'observer.extract'),
      ).toThrow(/reserved XML tag "<observations>"/);
    });

    it('includes the context name in error messages', () => {
      expect(() =>
        validateExtractorList([new Extractor({ name: 'Observations', instructions: 'x' })], 'reflector.extract'),
      ).toThrow(/reflector\.extract/);
    });
  });

  describe('buildExtractorOutputSections', () => {
    it('returns empty string for empty input', () => {
      expect(buildExtractorOutputSections([])).toBe('');
    });

    it('renders one <slug> section per extractor', () => {
      const result = buildExtractorOutputSections([
        new Extractor({ name: 'Follows Policy', instructions: 'Output ok or violation.' }),
        new Extractor({ name: 'User Profile', instructions: 'JSON-ish blob.' }),
      ]);
      expect(result).toContain('<follows-policy>\nOutput ok or violation.\n</follows-policy>');
      expect(result).toContain('<user-profile>\nJSON-ish blob.\n</user-profile>');
    });
  });

  describe('buildExtractorPriorLines', () => {
    it('returns nothing when priorValues is undefined', () => {
      expect(
        buildExtractorPriorLines(
          [new Extractor({ name: 'foo', instructions: 'x', injectionBehaviour: 'carry-forward' })],
          undefined,
        ),
      ).toEqual([]);
    });

    it('only emits lines for extractors with carry-forward and non-empty prior values', () => {
      const lines = buildExtractorPriorLines(
        [
          new Extractor({ name: 'foo', instructions: 'x', injectionBehaviour: 'carry-forward' }),
          new Extractor({ name: 'bar', instructions: 'x', injectionBehaviour: 'none' }),
          new Extractor({ name: 'baz', instructions: 'x', injectionBehaviour: 'carry-forward' }),
        ],
        { foo: 'hello', bar: 'ignored', baz: '' },
      );
      expect(lines).toEqual(['- prior foo: hello']);
    });

    it('stringifies non-string values via JSON', () => {
      const lines = buildExtractorPriorLines(
        [
          new Extractor({
            name: 'profile',
            instructions: 'x',
            schema: z.object({ name: z.string() }),
            injectionBehaviour: 'carry-forward',
          }),
        ],
        { profile: { name: 'alice' } },
      );
      expect(lines).toEqual(['- prior profile: {"name":"alice"}']);
    });
  });

  describe('parseExtractedValues', () => {
    const extractors = [
      new Extractor({ name: 'follows-policy', instructions: 'x' }),
      new Extractor({
        name: 'user-profile',
        instructions: 'x',
        schema: z.object({ name: z.string() }),
      }),
    ];

    it('parses leading-line XML sections', () => {
      const content = [
        '<follows-policy>',
        'ok',
        '</follows-policy>',
        '<user-profile>',
        '{"name":"alice"}',
        '</user-profile>',
      ].join('\n');
      expect(parseExtractedValues(content, extractors)).toEqual({
        'follows-policy': 'ok',
        'user-profile': { name: 'alice' },
      });
    });

    it('returns empty when content is empty or no extractors', () => {
      expect(parseExtractedValues('', extractors)).toEqual({});
      expect(parseExtractedValues('<follows-policy>ok</follows-policy>', [])).toEqual({});
    });

    it('omits extractors whose tags are missing', () => {
      expect(parseExtractedValues('<follows-policy>ok</follows-policy>', extractors)).toEqual({
        'follows-policy': 'ok',
      });
    });

    it('skips invalid JSON/schema values and reports parse errors', () => {
      const onParseError = vi.fn();
      const content = [
        '<follows-policy>',
        'ok',
        '</follows-policy>',
        '<user-profile>',
        '{"name":123}',
        '</user-profile>',
      ].join('\n');

      expect(parseExtractedValues(content, extractors, { onParseError })).toEqual({
        'follows-policy': 'ok',
      });
      expect(onParseError).toHaveBeenCalledTimes(1);
      expect(onParseError.mock.calls[0]![0]!.extractor.slug).toBe('user-profile');
    });

    it('ignores inline mentions of the tag inside other content', () => {
      // Tag must appear at start of a line; inline mention should NOT be captured.
      const content = 'Some observation that mentions <follows-policy>foo</follows-policy> inline.';
      expect(parseExtractedValues(content, extractors)).toEqual({});
    });
  });

  describe('stripExtractorSections', () => {
    it('removes XML sections for given extractors', () => {
      const content =
        'before\n<follows-policy>ok</follows-policy>\nmiddle\n<user-profile>\nblob\n</user-profile>\nafter';
      const result = stripExtractorSections(content, [
        new Extractor({ name: 'follows-policy', instructions: 'x' }),
        new Extractor({ name: 'user-profile', instructions: 'x' }),
      ]);
      expect(result).not.toContain('<follows-policy>');
      expect(result).not.toContain('<user-profile>');
      expect(result).toContain('before');
      expect(result).toContain('middle');
      expect(result).toContain('after');
    });

    it('preserves inline tag mentions', () => {
      const content = 'User talked about the <follows-policy> tag inline.';
      expect(stripExtractorSections(content, [new Extractor({ name: 'follows-policy', instructions: 'x' })])).toBe(
        content,
      );
    });

    it('passes through unchanged when no extractors', () => {
      expect(stripExtractorSections('hello', [])).toBe('hello');
    });
  });

  describe('getExtractedValueForExtractor', () => {
    it('reads built-in slugs from dedicated fields', () => {
      const values = {
        currentTask: 'task',
        suggestedContinuation: 'sugg',
        threadTitle: 'title',
        extractedValues: { 'follows-policy': 'ok' },
      };
      expect(getExtractedValueForExtractor(Extractor.currentTask(), values)).toBe('task');
      expect(getExtractedValueForExtractor(Extractor.suggestedResponse(), values)).toBe('sugg');
      expect(getExtractedValueForExtractor(Extractor.threadTitle(), values)).toBe('title');
    });

    it('reads custom slugs from extractedValues map', () => {
      const values = { extractedValues: { 'follows-policy': 'ok' } };
      const ext = new Extractor({ name: 'follows-policy', instructions: 'x' });
      expect(getExtractedValueForExtractor(ext, values)).toBe('ok');
    });

    it('returns undefined when the slug is not present', () => {
      const ext = new Extractor({ name: 'follows-policy', instructions: 'x' });
      expect(getExtractedValueForExtractor(ext, {})).toBeUndefined();
    });
  });

  describe('invokeExtractorHooks', () => {
    it('fires onExtracted only for extractors with a value and returns current values by default', async () => {
      const policyHook = vi.fn();
      const profileHook = vi.fn();
      const extractors = [
        new Extractor({ name: 'follows-policy', instructions: 'x', onExtracted: policyHook }),
        new Extractor({ name: 'user-profile', instructions: 'x', onExtracted: profileHook }),
      ];

      const result = await invokeExtractorHooks(
        extractors,
        { extractedValues: { 'follows-policy': 'violation: rule X' } },
        {
          ...observerHookContext,
          threadId: 't1',
          resourceId: 'r1',
          mainAgent,
          requestContext,
          previousValues: { extractedValues: { 'follows-policy': 'prior value' } },
        },
      );

      expect(result).toEqual({ 'follows-policy': 'violation: rule X' });
      expect(policyHook).toHaveBeenCalledTimes(1);
      const call = policyHook.mock.calls[0]![0]!;
      expect(call.extracted).toEqual({ previous: 'prior value', current: 'violation: rule X' });
      expect(call.threadId).toBe('t1');
      expect(call.resourceId).toBe('r1');
      expect(call.mainAgent).toBe(mainAgent);
      expect(call.requestContext).toBe(requestContext);
      expect(call.extractor.slug).toBe('follows-policy');
      expect(call.source).toBe('observer');
      expect(call.observations.observedMessages).toBe(observedMessages);
      expect(call.observations.observedMessages[0]).toMatchObject({
        id: 'message-1',
        threadId: 't1',
        resourceId: 'r1',
        content: { format: 2 },
      });
      expect(call.observations.activeObservations).toBe('Date: yesterday\n* Prior observation');
      expect(call.observations.newObservations).toBe('Date: today\n* New observation');

      // user-profile has no value emitted → hook must not fire
      expect(profileHook).not.toHaveBeenCalled();
    });

    it('uses a returned value as the normalized custom extracted value', async () => {
      const ext = new Extractor({
        name: 'user-profile',
        instructions: 'x',
        schema: z.object({ name: z.string(), visits: z.number() }),
        onExtracted: ({ extracted }) => ({ ...extracted.previous, ...extracted.current, visits: 2 }),
      });

      const result = await invokeExtractorHooks(
        [ext],
        { extractedValues: { 'user-profile': { name: 'alice', visits: 1 } } },
        {
          ...observerHookContext,
          threadId: 't1',
          mainAgent,
          requestContext,
          previousValues: { extractedValues: { 'user-profile': { name: 'old', visits: 1 } } },
        },
      );

      expect(result).toEqual({ 'user-profile': { name: 'alice', visits: 2 } });
    });

    it('falls back to current when a returned value fails schema validation', async () => {
      const onError = vi.fn();
      const ext = new Extractor({
        name: 'score',
        instructions: 'x',
        schema: z.object({ value: z.number() }),
        onExtracted: () => ({ value: 'invalid' }) as any,
      });

      const result = await invokeExtractorHooks(
        [ext],
        { extractedValues: { score: { value: 1 } } },
        { ...observerHookContext, threadId: 't1', mainAgent, requestContext },
        onError,
      );

      expect(result).toEqual({ score: { value: 1 } });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]![0]!.slug).toBe('score');
    });

    it('does not fail the cycle when a user hook throws and does not block other hooks', async () => {
      const badHook = vi.fn(() => {
        throw new Error('boom');
      });
      const goodHook = vi.fn(() => 'normalized');
      const onError = vi.fn();

      const extractors: ReadonlyArray<Extractor<any>> = [
        new Extractor<string>({ name: 'bad', instructions: 'x', onExtracted: badHook }),
        new Extractor<string>({ name: 'good', instructions: 'x', onExtracted: goodHook }),
      ];

      const result = await invokeExtractorHooks(
        extractors,
        { extractedValues: { bad: 'b', good: 'g' } },
        { ...observerHookContext, threadId: 't1', mainAgent, requestContext },
        onError,
      );

      expect(result).toEqual({ bad: 'b', good: 'normalized' });
      expect(badHook).toHaveBeenCalledTimes(1);
      expect(goodHook).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]![0]!.slug).toBe('bad');
      expect((onError.mock.calls[0]![1] as Error).message).toBe('boom');
    });

    it('passes typed previous/current extracted values to hooks with thread context', async () => {
      const hook = vi.fn();
      const ext = new Extractor({
        name: 'user-profile',
        instructions: 'x',
        schema: z.object({ name: z.string() }),
        onExtracted: hook,
      });

      await invokeExtractorHooks(
        [ext],
        { extractedValues: { 'user-profile': { name: 'alice' } } },
        {
          ...observerHookContext,
          threadId: 't1',
          mainAgent,
          requestContext,
          previousValues: { extractedValues: { 'user-profile': { name: 'bob' } } },
        },
      );

      expect(hook).toHaveBeenCalledTimes(1);
      const ctx = hook.mock.calls[0]![0]!;
      expect(ctx.extracted).toEqual({ previous: { name: 'bob' }, current: { name: 'alice' } });
      expect(ctx.threadId).toBe('t1');
      expect(ctx.mainAgent).toBe(mainAgent);
      expect(ctx.requestContext).toBe(requestContext);
      expect(Object.keys(ctx)).not.toContain('run' + 'Id');
    });

    it('calls built-in hooks with previous/current but ignores returned values', async () => {
      const hook = vi.fn(() => 'Changed Title');
      const ext = Extractor.threadTitle({ onExtracted: hook });

      const result = await invokeExtractorHooks(
        [ext],
        { threadTitle: 'Current Title' },
        {
          ...reflectorHookContext,
          threadId: 't1',
          mainAgent,
          requestContext,
          previousValues: { threadTitle: 'Prior Title' },
        },
      );

      expect(result).toEqual({});
      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'reflector',
          extracted: { previous: 'Prior Title', current: 'Current Title' },
          observations: {
            activeObservations: 'Date: yesterday\n* Prior observation',
            newObservations: 'Date: today\n* Reflected observation',
          },
        }),
      );
      const reflectorCall = (hook as any).mock.calls[0]![0]!;
      expect(reflectorCall.observations).not.toHaveProperty('observedMessages');
    });
  });
});
