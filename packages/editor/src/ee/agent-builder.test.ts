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

  describe('getFeatures (default-on semantics)', () => {
    it('returns all features defaulted to true (browser stays false without config)', () => {
      const builder = new EditorAgentBuilder({});
      expect(builder.getFeatures()?.agent).toEqual({
        tools: true,
        agents: true,
        workflows: true,
        scorers: true,
        skills: true,
        memory: true,
        variables: true,
        stars: true,
        avatarUpload: true,
        model: true,
        browser: false,
      });
    });

    it('explicit false overrides the default-on for the listed keys', () => {
      const builder = new EditorAgentBuilder({ features: { agent: { tools: false, memory: false } } });
      const resolved = builder.getFeatures()?.agent;
      expect(resolved?.tools).toBe(false);
      expect(resolved?.memory).toBe(false);
      // siblings remain default-on
      expect(resolved?.agents).toBe(true);
      expect(resolved?.workflows).toBe(true);
      expect(resolved?.skills).toBe(true);
    });

    it('explicit toggles round-trip while omitted keys default to true', () => {
      const builder = new EditorAgentBuilder({
        features: {
          agent: {
            tools: true,
            workflows: false,
            skills: false,
            variables: false,
          },
        },
      });
      expect(builder.getFeatures()?.agent).toEqual({
        tools: true,
        agents: true,
        workflows: false,
        scorers: true,
        skills: false,
        memory: true,
        variables: false,
        stars: true,
        avatarUpload: true,
        model: true,
        browser: false,
      });
    });

    it('browser defaults to true when a valid browser config is provided', () => {
      const builder = new EditorAgentBuilder({
        configuration: {
          agent: {
            browser: { type: 'inline' as const, config: { provider: 'stagehand' } },
          },
        },
      });
      expect(builder.getFeatures()?.agent?.browser).toBe(true);
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

    it('throws when locked mode (model: false) has no default model', () => {
      expect(
        () =>
          new EditorAgentBuilder({
            features: { agent: { model: false } },
            configuration: {
              agent: { models: { allowed: [{ provider: 'openai' }] } },
            },
          }),
      ).toThrow(/locked mode but no default/);
    });

    it('does not require a default in open mode (model defaults to true)', () => {
      expect(
        () =>
          new EditorAgentBuilder({
            configuration: {
              agent: { models: { allowed: [{ provider: 'openai' }] } },
            },
          }),
      ).not.toThrow();
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

  describe('browser config validation', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('silently keeps browser=false when no config is provided (default-on, no warning)', () => {
      // With default-on, omitted `browser` is implicitly true, but the missing
      // browser config downgrades it silently — admins who never configured
      // the browser shouldn't see warnings about a feature they never opted in to.
      const builder = new EditorAgentBuilder({
        features: { agent: { tools: true } },
      });
      expect(builder.getModelPolicyWarnings()).toEqual([]);
      expect(builder.getFeatures()?.agent?.browser).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns only when browser is *explicitly* enabled but config is missing', () => {
      const builder = new EditorAgentBuilder({
        features: { agent: { browser: true } },
      });
      expect(builder.getFeatures()?.agent?.browser).toBe(false);
      expect(builder.getModelPolicyWarnings()).toHaveLength(1);
      expect(builder.getModelPolicyWarnings()[0]).toMatch(/no default browser config was provided/);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('downgrades browser to false and warns when config exists but has no provider', () => {
      const builder = new EditorAgentBuilder({
        features: { agent: { browser: true } },
        configuration: {
          agent: {
            browser: { type: 'inline' as const, config: {} as any },
          },
        },
      });
      expect(builder.getFeatures()?.agent?.browser).toBe(false);
      expect(builder.getModelPolicyWarnings()).toHaveLength(1);
      expect(builder.getModelPolicyWarnings()[0]).toMatch(/missing a `provider` field/);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps browser enabled when feature and config are both set correctly', () => {
      const builder = new EditorAgentBuilder({
        features: { agent: { browser: true } },
        configuration: {
          agent: {
            browser: { type: 'inline' as const, config: { provider: 'stagehand' } },
          },
        },
      });
      expect(builder.getFeatures()?.agent?.browser).toBe(true);
      expect(builder.getModelPolicyWarnings()).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does nothing when browser feature is false', () => {
      const builder = new EditorAgentBuilder({
        features: { agent: { browser: false } },
      });
      expect(builder.getFeatures()?.agent?.browser).toBe(false);
      expect(builder.getModelPolicyWarnings()).toEqual([]);
    });

    it('downgrades browser and warns when configuration.agent is set but browser key is missing', () => {
      const builder = new EditorAgentBuilder({
        features: { agent: { browser: true } },
        configuration: { agent: {} },
      });
      expect(builder.getFeatures()?.agent?.browser).toBe(false);
      expect(builder.getModelPolicyWarnings()).toHaveLength(1);
      expect(builder.getModelPolicyWarnings()[0]).toMatch(/no default browser config was provided/);
    });
  });
});
