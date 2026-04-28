import type { ProviderModelEntry } from '@mastra/core/agent-builder/ee';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorAgentBuilder } from './agent-builder';

describe('EditorAgentBuilder', () => {
  describe('enabled', () => {
    it('returns true when options.enabled is omitted', () => {
      const builder = new EditorAgentBuilder({});
      expect(builder.enabled).toBe(true);
    });

    it('returns true when options.enabled is true', () => {
      const builder = new EditorAgentBuilder({ enabled: true });
      expect(builder.enabled).toBe(true);
    });

    it('returns false when options.enabled is false', () => {
      const builder = new EditorAgentBuilder({ enabled: false });
      expect(builder.enabled).toBe(false);
    });

    it('returns true when options is empty', () => {
      const builder = new EditorAgentBuilder();
      expect(builder.enabled).toBe(true);
    });
  });

  describe('getFeatures', () => {
    it('returns undefined when features not set', () => {
      const builder = new EditorAgentBuilder({});
      expect(builder.getFeatures()).toBeUndefined();
    });

    it('returns features object unchanged', () => {
      const features = { agent: { tools: true, memory: false } };
      const builder = new EditorAgentBuilder({ features });
      expect(builder.getFeatures()).toBe(features);
    });

    it('returns features with all toggles', () => {
      const features = {
        agent: {
          tools: true,
          agents: true,
          workflows: false,
          scorers: true,
          skills: false,
          memory: true,
          variables: false,
        },
      };
      const builder = new EditorAgentBuilder({ features });
      expect(builder.getFeatures()).toEqual(features);
    });
  });

  describe('getConfiguration', () => {
    it('returns undefined when configuration not set', () => {
      const builder = new EditorAgentBuilder({});
      expect(builder.getConfiguration()).toBeUndefined();
    });

    it('returns configuration object unchanged', () => {
      const configuration = { agent: { someKey: 'value' } };
      const builder = new EditorAgentBuilder({ configuration });
      expect(builder.getConfiguration()).toBe(configuration);
    });
  });

  describe('model policy validation', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('does not validate when builder is disabled', () => {
      expect(
        () =>
          new EditorAgentBuilder({
            enabled: false,
            // would otherwise trip the locked-mode rule
            configuration: { agent: { models: { allowed: [{ provider: 'openai' }] } } },
          }),
      ).not.toThrow();
    });

    it('does not validate when no builder model config is present', () => {
      expect(() => new EditorAgentBuilder({})).not.toThrow();
      expect(() => new EditorAgentBuilder({ features: { agent: { tools: true } } })).not.toThrow();
    });

    it('accepts locked mode with a default model', () => {
      expect(
        () =>
          new EditorAgentBuilder({
            configuration: {
              agent: { models: { default: { provider: 'openai', modelId: 'gpt-4o-mini' } } },
            },
          }),
      ).not.toThrow();
    });

    it('throws when locked mode has no default model', () => {
      expect(
        () =>
          new EditorAgentBuilder({
            configuration: {
              agent: { models: { allowed: [{ provider: 'openai' }] } },
            },
          }),
      ).toThrow(/locked mode but no default/);
    });

    it('accepts open mode + allowlist + default in allowlist', () => {
      expect(
        () =>
          new EditorAgentBuilder({
            features: { agent: { model: true } },
            configuration: {
              agent: {
                models: {
                  allowed: [{ provider: 'openai' }],
                  default: { provider: 'openai', modelId: 'gpt-4o-mini' },
                },
              },
            },
          }),
      ).not.toThrow();
    });

    it('accepts open mode + empty allowlist + no default', () => {
      expect(
        () =>
          new EditorAgentBuilder({
            features: { agent: { model: true } },
            configuration: { agent: { models: { allowed: [] } } },
          }),
      ).not.toThrow();
    });

    it('throws when default is not in a non-empty allowlist', () => {
      expect(
        () =>
          new EditorAgentBuilder({
            features: { agent: { model: true } },
            configuration: {
              agent: {
                models: {
                  allowed: [{ provider: 'openai', modelId: 'gpt-4o-mini' }],
                  default: { provider: 'anthropic', modelId: 'claude-opus-4-7' },
                },
              },
            },
          }),
      ).toThrow(/default model is not in the allowlist/);
    });

    it('warns (does not throw) on unknown provider strings without kind: custom', () => {
      const builder = new EditorAgentBuilder({
        features: { agent: { model: true } },
        configuration: {
          agent: {
            models: {
              // intentionally untagged: simulates an admin who forgot `kind: 'custom'`
              allowed: [{ provider: 'definitely-not-a-provider' } as unknown as ProviderModelEntry],
            },
          },
        },
      });
      expect(builder.getModelPolicyWarnings()).toHaveLength(1);
      expect(builder.getModelPolicyWarnings()[0]).toMatch(/definitely-not-a-provider/);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('does not warn for entries tagged kind: custom', () => {
      const builder = new EditorAgentBuilder({
        configuration: {
          agent: {
            models: {
              default: { kind: 'custom', provider: 'acme/gateway', modelId: 'foo-1' },
              allowed: [{ kind: 'custom', provider: 'acme/gateway' }],
            },
          },
        },
      });
      expect(builder.getModelPolicyWarnings()).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn for known providers in the registry', () => {
      const builder = new EditorAgentBuilder({
        configuration: {
          agent: {
            models: {
              default: { provider: 'openai', modelId: 'gpt-4o-mini' },
              allowed: [{ provider: 'openai' }, { provider: 'anthropic' }],
            },
          },
        },
      });
      expect(builder.getModelPolicyWarnings()).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
