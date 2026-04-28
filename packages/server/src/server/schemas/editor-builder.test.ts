import { describe, it, expect } from 'vitest';
import {
  agentConfigurationSchema,
  agentFeaturesSchema,
  agentModelsSchema,
  builderSettingsResponseSchema,
  defaultModelEntrySchema,
  providerModelEntrySchema,
} from './editor-builder';

describe('editor-builder schemas — admin model configuration', () => {
  describe('providerModelEntrySchema', () => {
    it('accepts a known-provider entry without modelId (provider wildcard)', () => {
      const result = providerModelEntrySchema.safeParse({ provider: 'openai' });
      expect(result.success).toBe(true);
    });

    it('accepts a known-provider entry with modelId', () => {
      const result = providerModelEntrySchema.safeParse({ provider: 'openai', modelId: 'gpt-4o-mini' });
      expect(result.success).toBe(true);
    });

    it('accepts a custom-provider entry round-trip', () => {
      const input = { kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' } as const;
      const result = providerModelEntrySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });

    it('rejects an entry with an empty provider string', () => {
      const result = providerModelEntrySchema.safeParse({ provider: '' });
      expect(result.success).toBe(false);
    });

    it('rejects unknown keys (e.g. typo `modelID`) via .strict()', () => {
      const result = providerModelEntrySchema.safeParse({ provider: 'openai', modelID: 'gpt-4o-mini' });
      expect(result.success).toBe(false);
    });

    it('rejects unknown keys on custom-tagged entries', () => {
      const result = providerModelEntrySchema.safeParse({
        kind: 'custom',
        provider: 'acme/custom',
        modelId: 'foo-1',
        extra: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('defaultModelEntrySchema', () => {
    it('requires modelId on known-provider defaults', () => {
      const result = defaultModelEntrySchema.safeParse({ provider: 'openai' });
      expect(result.success).toBe(false);
    });

    it('requires modelId on custom-provider defaults', () => {
      const result = defaultModelEntrySchema.safeParse({ kind: 'custom', provider: 'acme/custom' });
      expect(result.success).toBe(false);
    });

    it('accepts a custom default round-trip', () => {
      const input = { kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' } as const;
      const result = defaultModelEntrySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });

    it('rejects unknown keys on default entries via .strict()', () => {
      const result = defaultModelEntrySchema.safeParse({
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        Provider: 'openai',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('agentModelsSchema', () => {
    it('accepts allowed + default together', () => {
      const result = agentModelsSchema.safeParse({
        allowed: [
          { provider: 'openai' },
          { provider: 'anthropic', modelId: 'claude-opus-4-7' },
          { kind: 'custom', provider: 'acme/custom' },
        ],
        default: { provider: 'openai', modelId: 'gpt-4o-mini' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts an empty object', () => {
      const result = agentModelsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('agentConfigurationSchema', () => {
    it('keeps unknown keys via the catchall', () => {
      const input = { models: { default: { provider: 'openai', modelId: 'gpt-4o-mini' } }, maxTokens: 4096 };
      const result = agentConfigurationSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxTokens).toBe(4096);
      }
    });
  });

  describe('agentFeaturesSchema', () => {
    it('accepts the new model flag', () => {
      const result = agentFeaturesSchema.safeParse({ tools: true, model: false });
      expect(result.success).toBe(true);
    });

    it('rejects a non-boolean model flag', () => {
      const result = agentFeaturesSchema.safeParse({ model: 'true' });
      expect(result.success).toBe(false);
    });
  });

  describe('builderSettingsResponseSchema', () => {
    it('round-trips a full response with locked admin model configuration', () => {
      const input = {
        enabled: true,
        features: { agent: { model: false, tools: true } },
        configuration: {
          agent: {
            models: {
              allowed: [{ provider: 'openai' }, { kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' }],
              default: { provider: 'openai', modelId: 'gpt-4o-mini' },
            },
          },
        },
      };
      const result = builderSettingsResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });
  });
});
