import { describe, expect, it } from 'vitest';
import { toModelCandidates } from './normalize-candidate';
import type { ModelCandidateInput } from './normalize-candidate';

describe('toModelCandidates', () => {
  describe('null / undefined / function', () => {
    it('returns [] for null', () => {
      expect(toModelCandidates(null)).toEqual([]);
    });

    it('returns [] for undefined', () => {
      expect(toModelCandidates(undefined)).toEqual([]);
    });

    it('returns [] for a dynamic function (deferred to runtime defense)', () => {
      expect(toModelCandidates((() => 'openai/gpt-4o') as unknown as ModelCandidateInput)).toEqual([]);
    });
  });

  describe('runtime string', () => {
    it('splits a known-provider string', () => {
      const result = toModelCandidates('openai/gpt-4o-mini');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        origin: 'runtime',
        label: 'openai/gpt-4o-mini',
      });
    });

    it('returns [] for an unparsable string with no slash', () => {
      expect(toModelCandidates('gpt-4o')).toEqual([]);
    });

    it('falls back to first-slash split for unknown gateway prefixes', () => {
      // `acme` is not a registered provider, so this falls back to first-slash split.
      const result = toModelCandidates('acme/foo-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ provider: 'acme', modelId: 'foo-1', origin: 'runtime' });
    });

    it('preserves multi-slash model IDs under unknown gateways via first-slash split', () => {
      // Without registry registration `acme/custom/foo-1` falls back to provider=acme, model=custom/foo-1.
      const result = toModelCandidates('acme/custom/foo-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ provider: 'acme', modelId: 'custom/foo-1' });
    });
  });

  describe('OpenAICompatibleConfig', () => {
    it('handles the `{ id: "provider/model" }` form', () => {
      const result = toModelCandidates({ id: 'openai/gpt-4o', apiKey: 'sk-x' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        provider: 'openai',
        modelId: 'gpt-4o',
        origin: 'openai-compatible',
      });
    });

    it('handles the `{ providerId, modelId }` form', () => {
      const result = toModelCandidates({ providerId: 'acme', modelId: 'foo-1' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        provider: 'acme',
        modelId: 'foo-1',
        origin: 'openai-compatible',
      });
    });
  });

  describe('SDK language model instance', () => {
    it('extracts provider + modelId from an object with doGenerate()', () => {
      const sdkModel = {
        provider: 'openai',
        modelId: 'gpt-4o',
        doGenerate: () => Promise.resolve({}),
      } as unknown as ModelCandidateInput;
      const result = toModelCandidates(sdkModel);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        provider: 'openai',
        modelId: 'gpt-4o',
        origin: 'sdk-instance',
      });
    });
  });

  describe('stored static `{ provider, name }`', () => {
    it('extracts a candidate from `{ provider, name }`', () => {
      const result = toModelCandidates({ provider: 'openai', name: 'gpt-4o' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        provider: 'openai',
        modelId: 'gpt-4o',
        origin: 'static',
      });
    });
  });

  describe('conditional variants', () => {
    it('walks every variant and labels the rule-less variant as default', () => {
      const conditional = [
        { value: 'openai/gpt-4o', rules: { operator: 'AND', conditions: [] } },
        { value: { provider: 'anthropic', name: 'claude-opus-4-7' } },
      ] as unknown as ModelCandidateInput;
      const result = toModelCandidates(conditional);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        provider: 'openai',
        modelId: 'gpt-4o',
        origin: 'conditional-variant',
        label: 'variant[0]',
      });
      expect(result[1]).toMatchObject({
        provider: 'anthropic',
        modelId: 'claude-opus-4-7',
        origin: 'conditional-default',
      });
      expect(result[1]?.label).toContain('variant[1]');
    });

    it('skips variants whose value cannot be normalized', () => {
      const conditional = [
        { value: 'no-slash-model' }, // unparsable
        { value: 'openai/gpt-4o' },
      ] as unknown as ModelCandidateInput;
      const result = toModelCandidates(conditional);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ provider: 'openai', modelId: 'gpt-4o' });
    });
  });
});
