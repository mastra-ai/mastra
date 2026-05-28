import { describe, expect, it } from 'vitest';
import { isModelAllowedByPolicy, matchesProvider } from './model-policy';
import type { ProviderModelEntry } from './types';

const MODEL_ID = '__AI_SDK_OPENAI_MODEL_REALTIME__';
const OTHER_MODEL_ID = '__GATEWAY_OPENAI_MODEL_MINI__';

describe('matchesProvider', () => {
  it('matches every model for a provider wildcard', () => {
    expect(matchesProvider({ provider: 'openai' }, { provider: 'openai', modelId: MODEL_ID })).toBe(true);
  });

  it('requires provider and modelId to match for explicit entries', () => {
    expect(matchesProvider({ provider: 'openai', modelId: MODEL_ID }, { provider: 'openai', modelId: MODEL_ID })).toBe(
      true,
    );
    expect(
      matchesProvider({ provider: 'openai', modelId: MODEL_ID }, { provider: 'openai', modelId: OTHER_MODEL_ID }),
    ).toBe(false);
  });
});

describe('isModelAllowedByPolicy', () => {
  it('treats undefined and empty allowlists as unrestricted', () => {
    expect(isModelAllowedByPolicy(undefined, { provider: 'openai', modelId: MODEL_ID })).toBe(true);
    expect(isModelAllowedByPolicy([], { provider: 'openai', modelId: MODEL_ID })).toBe(true);
  });

  it('applies provider wildcards and explicit model entries', () => {
    const allowed: ProviderModelEntry[] = [{ provider: 'openai' }, { provider: 'anthropic', modelId: MODEL_ID }];

    expect(isModelAllowedByPolicy(allowed, { provider: 'openai', modelId: OTHER_MODEL_ID })).toBe(true);
    expect(isModelAllowedByPolicy(allowed, { provider: 'anthropic', modelId: MODEL_ID })).toBe(true);
    expect(isModelAllowedByPolicy(allowed, { provider: 'anthropic', modelId: OTHER_MODEL_ID })).toBe(false);
  });

  it('ignores unknown non-custom providers when a provider registry predicate is supplied', () => {
    const allowed: ProviderModelEntry[] = [{ provider: 'openaii' as unknown as 'openai' }, { provider: 'anthropic' }];
    const registeredProviders = new Set(['anthropic']);

    expect(
      isModelAllowedByPolicy(
        allowed,
        { provider: 'anthropic', modelId: MODEL_ID },
        {
          isProviderRegistered: provider => registeredProviders.has(provider),
        },
      ),
    ).toBe(true);
    expect(
      isModelAllowedByPolicy(
        allowed,
        { provider: 'openai', modelId: MODEL_ID },
        {
          isProviderRegistered: provider => registeredProviders.has(provider),
        },
      ),
    ).toBe(false);
  });

  it('denies everything when all registry-aware entries are unknown non-custom providers', () => {
    const allowed: ProviderModelEntry[] = [{ provider: 'openaii' as unknown as 'openai' }];

    expect(
      isModelAllowedByPolicy(allowed, { provider: 'openai', modelId: MODEL_ID }, { isProviderRegistered: () => false }),
    ).toBe(false);
  });

  it('keeps custom entries active even when they are not in the provider registry', () => {
    const allowed: ProviderModelEntry[] = [{ kind: 'custom', provider: 'acme/custom', modelId: MODEL_ID }];

    expect(
      isModelAllowedByPolicy(
        allowed,
        { provider: 'acme/custom', modelId: MODEL_ID },
        {
          isProviderRegistered: provider => provider === 'openai',
        },
      ),
    ).toBe(true);
    expect(
      isModelAllowedByPolicy(
        allowed,
        { provider: 'openai', modelId: MODEL_ID },
        {
          isProviderRegistered: provider => provider === 'openai',
        },
      ),
    ).toBe(false);
  });
});
