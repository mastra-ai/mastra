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
    it('fires onExtracted only for extractors with a value', async () => {
      const policyHook = vi.fn();
      const profileHook = vi.fn();
      const extractors = [
        new Extractor({ name: 'follows-policy', instructions: 'x', onExtracted: policyHook }),
        new Extractor({ name: 'user-profile', instructions: 'x', onExtracted: profileHook }),
      ];

      await invokeExtractorHooks(
        extractors,
        { extractedValues: { 'follows-policy': 'violation: rule X' } },
        { threadId: 't1', resourceId: 'r1' },
      );

      expect(policyHook).toHaveBeenCalledTimes(1);
      const call = policyHook.mock.calls[0]![0]!;
      expect(call.extracted).toBe('violation: rule X');
      expect(call.threadId).toBe('t1');
      expect(call.resourceId).toBe('r1');
      expect(call.extractor.slug).toBe('follows-policy');

      // user-profile has no value emitted → hook must not fire
      expect(profileHook).not.toHaveBeenCalled();
    });

    it('does not fail the cycle when a user hook throws', async () => {
      const badHook = vi.fn(() => {
        throw new Error('boom');
      });
      const goodHook = vi.fn();
      const onError = vi.fn();

      const extractors = [
        new Extractor({ name: 'bad', instructions: 'x', onExtracted: badHook }),
        new Extractor({ name: 'good', instructions: 'x', onExtracted: goodHook }),
      ];

      await invokeExtractorHooks(extractors, { extractedValues: { bad: 'b', good: 'g' } }, { threadId: 't1' }, onError);

      expect(badHook).toHaveBeenCalledTimes(1);
      expect(goodHook).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]![0]!.slug).toBe('bad');
      expect((onError.mock.calls[0]![1] as Error).message).toBe('boom');
    });

    it('passes typed extracted values to hooks with thread context', async () => {
      const hook = vi.fn();
      const ext = new Extractor({
        name: 'user-profile',
        instructions: 'x',
        schema: z.object({ name: z.string() }),
        onExtracted: hook,
      });

      await invokeExtractorHooks([ext], { extractedValues: { 'user-profile': { name: 'alice' } } }, { threadId: 't1' });

      expect(hook).toHaveBeenCalledTimes(1);
      const ctx = hook.mock.calls[0]![0]!;
      expect(ctx.extracted).toEqual({ name: 'alice' });
      expect(ctx.threadId).toBe('t1');
      expect(Object.keys(ctx)).not.toContain('run' + 'Id');
    });
  });
});
