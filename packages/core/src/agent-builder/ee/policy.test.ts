import { describe, expect, it } from 'vitest';
import { builderToModelPolicy, isBuilderModelPolicyActive } from './policy';
import type { AgentBuilderOptions, IAgentBuilder } from './types';

function makeBuilder(opts: { enabled?: boolean; options?: AgentBuilderOptions } = {}): IAgentBuilder {
  const enabled = opts.enabled ?? true;
  const options = opts.options ?? {};
  return {
    enabled,
    getFeatures: () => options.features,
    getConfiguration: () => options.configuration,
  };
}

describe('isBuilderModelPolicyActive', () => {
  it('is inactive when builder is disabled', () => {
    expect(
      isBuilderModelPolicyActive({
        enabled: false,
        pickerVisible: true,
        allowed: [{ provider: 'openai' }],
        default: { provider: 'openai', modelId: 'gpt-4o' },
      }),
    ).toBe(false);
  });

  it('is inactive when enabled but no model-slice signal is present', () => {
    expect(isBuilderModelPolicyActive({ enabled: true, pickerVisible: false })).toBe(false);
  });

  it('is active when picker is visible (open mode)', () => {
    expect(isBuilderModelPolicyActive({ enabled: true, pickerVisible: true })).toBe(true);
  });

  it('is active when an allowlist is set', () => {
    expect(isBuilderModelPolicyActive({ enabled: true, pickerVisible: false, allowed: [] })).toBe(true);
    expect(isBuilderModelPolicyActive({ enabled: true, pickerVisible: false, allowed: [{ provider: 'openai' }] })).toBe(
      true,
    );
  });

  it('is active when a default model is set', () => {
    expect(
      isBuilderModelPolicyActive({
        enabled: true,
        pickerVisible: false,
        default: { provider: 'openai', modelId: 'gpt-4o' },
      }),
    ).toBe(true);
  });
});

describe('builderToModelPolicy', () => {
  it('returns inactive when builder is undefined', () => {
    expect(builderToModelPolicy(undefined)).toEqual({ active: false });
  });

  it('returns inactive when builder.enabled is false', () => {
    const builder = makeBuilder({
      enabled: false,
      options: {
        features: { agent: { model: true } },
        configuration: { agent: { models: { default: { provider: 'openai', modelId: 'gpt-4o' } } } },
      },
    });
    expect(builderToModelPolicy(builder)).toEqual({ active: false });
  });

  it('returns inactive when there is no model-slice signal', () => {
    const builder = makeBuilder({
      options: { features: { agent: { tools: true } } }, // unrelated feature flag
    });
    expect(builderToModelPolicy(builder)).toEqual({ active: false });
  });

  it('returns active + pickerVisible:false when only an allowlist is set (locked, no default)', () => {
    // NOTE: Phase 4 validation rejects locked + no-default at boot, but the pure
    // derivation still has to handle the shape if it reaches this code.
    const builder = makeBuilder({
      options: {
        configuration: { agent: { models: { allowed: [{ provider: 'openai' }] } } },
      },
    });
    expect(builderToModelPolicy(builder)).toEqual({
      active: true,
      pickerVisible: false,
      allowed: [{ provider: 'openai' }],
    });
  });

  it('returns active + pickerVisible:false + default in locked mode with a default model', () => {
    const builder = makeBuilder({
      options: {
        configuration: {
          agent: {
            models: {
              allowed: [{ provider: 'openai' }],
              default: { provider: 'openai', modelId: 'gpt-4o' },
            },
          },
        },
      },
    });
    expect(builderToModelPolicy(builder)).toEqual({
      active: true,
      pickerVisible: false,
      allowed: [{ provider: 'openai' }],
      default: { provider: 'openai', modelId: 'gpt-4o' },
    });
  });

  it('returns active + pickerVisible:true in open mode with no allowlist', () => {
    const builder = makeBuilder({
      options: {
        features: { agent: { model: true } },
      },
    });
    expect(builderToModelPolicy(builder)).toEqual({ active: true, pickerVisible: true });
  });

  it('returns active + pickerVisible:true + allowed + default in open mode', () => {
    const builder = makeBuilder({
      options: {
        features: { agent: { model: true } },
        configuration: {
          agent: {
            models: {
              allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }],
              default: { provider: 'openai', modelId: 'gpt-4o-mini' },
            },
          },
        },
      },
    });
    expect(builderToModelPolicy(builder)).toEqual({
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }],
      default: { provider: 'openai', modelId: 'gpt-4o-mini' },
    });
  });

  it('preserves allowed: [] (empty allowlist) in the derived policy', () => {
    const builder = makeBuilder({
      options: {
        features: { agent: { model: true } },
        configuration: { agent: { models: { allowed: [] } } },
      },
    });
    expect(builderToModelPolicy(builder)).toEqual({
      active: true,
      pickerVisible: true,
      allowed: [],
    });
  });
});
