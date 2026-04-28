import { MASTRA_BUILDER_MODEL_POLICY_KEY } from '@mastra/core/agent-builder/ee';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect } from 'vitest';

import { seedBuilderModelPolicy } from './seed-builder-model-policy';

const makeEditor = (overrides: Partial<{ enabled: boolean; features: any; configuration: any }> = {}) => {
  const builder = {
    enabled: overrides.enabled ?? true,
    getFeatures: () => overrides.features ?? { agent: { model: false } },
    getConfiguration: () => overrides.configuration ?? {},
  };
  return {
    hasEnabledBuilderConfig: () => builder.enabled,
    resolveBuilder: async () => builder,
  } as any;
};

describe('seedBuilderModelPolicy', () => {
  it('seeds an inactive policy when no editor is provided', async () => {
    const ctx = new RequestContext();
    const policy = await seedBuilderModelPolicy(undefined, ctx);
    expect(policy).toEqual({ active: false });
    expect(ctx.get(MASTRA_BUILDER_MODEL_POLICY_KEY)).toEqual({ active: false });
  });

  it('seeds an inactive policy when builder is disabled', async () => {
    const ctx = new RequestContext();
    const policy = await seedBuilderModelPolicy(makeEditor({ enabled: false }), ctx);
    expect(policy.active).toBe(false);
    expect((ctx.get(MASTRA_BUILDER_MODEL_POLICY_KEY) as any).active).toBe(false);
  });

  it('seeds an active policy with allowed list when configured', async () => {
    const ctx = new RequestContext();
    const policy = await seedBuilderModelPolicy(
      makeEditor({
        configuration: {
          agent: {
            models: {
              allowed: [{ kind: 'known', provider: 'openai' }],
              default: { provider: 'openai', modelId: 'gpt-4o-mini' },
            },
          },
        },
      }),
      ctx,
    );
    expect(policy.active).toBe(true);
    expect((ctx.get(MASTRA_BUILDER_MODEL_POLICY_KEY) as any).allowed).toEqual([{ kind: 'known', provider: 'openai' }]);
  });

  it('seed-then-merge: server-set value wins over a client-supplied policy spoof', async () => {
    const ctx = new RequestContext();
    await seedBuilderModelPolicy(
      makeEditor({
        configuration: { agent: { models: { allowed: [{ kind: 'known', provider: 'openai' }] } } },
      }),
      ctx,
    );

    // Simulate the in-handler "set first; client cannot overwrite" body merge loop.
    const bodyRequestContext: Record<string, unknown> = {
      [MASTRA_BUILDER_MODEL_POLICY_KEY]: { active: false },
    };
    for (const [key, value] of Object.entries(bodyRequestContext)) {
      if (ctx.get(key as any) === undefined) {
        ctx.set(key as any, value);
      }
    }

    const finalPolicy = ctx.get(MASTRA_BUILDER_MODEL_POLICY_KEY) as any;
    expect(finalPolicy.active).toBe(true);
    expect(finalPolicy.allowed).toEqual([{ kind: 'known', provider: 'openai' }]);
  });

  it('toJSON() does not leak the seeded policy', async () => {
    const ctx = new RequestContext();
    ctx.set('publicKey', 'visible');
    await seedBuilderModelPolicy(
      makeEditor({ configuration: { agent: { models: { allowed: [{ kind: 'known', provider: 'openai' }] } } } }),
      ctx,
    );

    const json = ctx.toJSON();
    expect(json).toEqual({ publicKey: 'visible' });
    expect(json).not.toHaveProperty(MASTRA_BUILDER_MODEL_POLICY_KEY);
  });
});
