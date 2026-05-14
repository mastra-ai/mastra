import { assertType, describe, expectTypeOf, it } from 'vitest';
import type {
  AgentFeatures,
  BuilderAgentDefaults,
  BuilderModelPolicy,
  CustomProviderEntry,
  DefaultModelEntry,
  KnownProviderEntry,
  ProviderModelEntry,
} from './types';

/**
 * Type-level tests for the Phase 1 contracts.
 * These compile-time assertions back the parent RFC's Phase 1 acceptance truths.
 *
 * Strategy: prove that
 *  - typos in known providers are rejected,
 *  - cross-provider model ids are rejected,
 *  - the wildcard form (no `modelId`) compiles for known providers,
 *  - `kind: 'custom'` accepts arbitrary strings,
 *  - `DefaultModelEntry` requires `modelId`,
 *  - `AgentFeatures.model` and `BuilderAgentDefaults.models` are optional.
 */
describe('agent-builder/ee — Phase 1 contract types', () => {
  describe('KnownProviderEntry', () => {
    it('accepts a valid provider + matching model id', () => {
      assertType<KnownProviderEntry>({ provider: 'openai', modelId: 'gpt-4o-mini' });
      assertType<KnownProviderEntry>({ provider: 'anthropic', modelId: 'claude-opus-4-7' });
    });

    it('accepts the wildcard shape (no modelId)', () => {
      assertType<KnownProviderEntry>({ provider: 'openai' });
    });

    it('rejects an unknown provider string', () => {
      // @ts-expect-error 'openaii' is not a valid Provider
      assertType<KnownProviderEntry>({ provider: 'openaii', modelId: 'gpt-4o-mini' });
    });

    it('rejects a model id that does not belong to the provider', () => {
      // @ts-expect-error 'claude-3-5-sonnet-latest' is not an openai model
      assertType<KnownProviderEntry>({ provider: 'openai', modelId: 'claude-3-5-sonnet-latest' });
    });
  });

  describe('CustomProviderEntry', () => {
    it('accepts an arbitrary provider string with the kind tag', () => {
      assertType<CustomProviderEntry>({ kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' });
      assertType<CustomProviderEntry>({ kind: 'custom', provider: 'whatever' });
    });

    it('requires the kind discriminant', () => {
      // @ts-expect-error missing kind: 'custom' tag
      assertType<CustomProviderEntry>({ provider: 'acme/custom', modelId: 'foo-1' });
    });
  });

  describe('ProviderModelEntry', () => {
    it('accepts both branches', () => {
      assertType<ProviderModelEntry>({ provider: 'openai', modelId: 'gpt-4o-mini' });
      assertType<ProviderModelEntry>({ kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' });
    });

    it('rejects an arbitrary string without kind: custom', () => {
      // @ts-expect-error untagged custom provider falls into the known-provider branch and fails
      assertType<ProviderModelEntry>({ provider: 'not-a-known-provider', modelId: 'foo' });
    });
  });

  describe('DefaultModelEntry', () => {
    it('requires modelId for known providers', () => {
      // @ts-expect-error modelId is required on the default entry
      assertType<DefaultModelEntry>({ provider: 'openai' });
    });

    it('requires modelId for custom providers', () => {
      // @ts-expect-error modelId is required on the default entry
      assertType<DefaultModelEntry>({ kind: 'custom', provider: 'acme/custom' });
    });

    it('accepts a valid known-provider default', () => {
      assertType<DefaultModelEntry>({ provider: 'openai', modelId: 'gpt-4o-mini' });
    });

    it('accepts a valid custom-provider default', () => {
      assertType<DefaultModelEntry>({ kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' });
    });
  });

  describe('AgentFeatures.model', () => {
    it('is optional and boolean', () => {
      const a: AgentFeatures = {};
      const b: AgentFeatures = { model: true };
      const c: AgentFeatures = { model: false };
      expectTypeOf(a).toExtend<AgentFeatures>();
      expectTypeOf(b).toExtend<AgentFeatures>();
      expectTypeOf(c).toExtend<AgentFeatures>();
    });

    it('rejects non-boolean values', () => {
      // @ts-expect-error model must be boolean
      const x: AgentFeatures = { model: 'true' };
      void x;
    });
  });

  describe('BuilderAgentDefaults.models', () => {
    it('accepts only allowed', () => {
      const d: BuilderAgentDefaults = {
        models: { allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }] },
      };
      void d;
    });

    it('accepts only default', () => {
      const d: BuilderAgentDefaults = { models: { default: { provider: 'openai', modelId: 'gpt-4o-mini' } } };
      void d;
    });

    it('accepts both', () => {
      const d: BuilderAgentDefaults = {
        models: {
          allowed: [{ provider: 'openai' }],
          default: { provider: 'openai', modelId: 'gpt-4o-mini' },
        },
      };
      void d;
    });

    it('accepts custom-gateway entries', () => {
      const d: BuilderAgentDefaults = {
        models: {
          allowed: [{ kind: 'custom', provider: 'acme/custom' }],
          default: { kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' },
        },
      };
      void d;
    });
  });

  describe('BuilderModelPolicy', () => {
    it('accepts inactive shape with no other fields', () => {
      const p: BuilderModelPolicy = { active: false };
      void p;
    });

    it('accepts open active shape', () => {
      const p: BuilderModelPolicy = {
        active: true,
        pickerVisible: true,
        allowed: [{ provider: 'openai' }],
        default: { provider: 'openai', modelId: 'gpt-4o-mini' },
      };
      void p;
    });

    it('accepts locked active shape', () => {
      const p: BuilderModelPolicy = {
        active: true,
        pickerVisible: false,
        default: { provider: 'openai', modelId: 'gpt-4o-mini' },
      };
      void p;
    });

    it('requires the active field', () => {
      // @ts-expect-error active is required
      const p: BuilderModelPolicy = { pickerVisible: true };
      void p;
    });
  });
});
