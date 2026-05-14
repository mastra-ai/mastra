import { describe, expect, it } from 'vitest';
import { enforceModelAllowlist, isModelAllowed, matchesProvider } from './allowlist';
import type { ModelCandidateInput } from './normalize-candidate';
import type { ProviderModelEntry } from './types';

describe('matchesProvider', () => {
  it('matches when modelId is omitted (provider wildcard)', () => {
    expect(matchesProvider({ provider: 'openai' }, { provider: 'openai', modelId: 'gpt-4o-mini' })).toBe(true);
  });

  it('does not match a different provider', () => {
    expect(matchesProvider({ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' })).toBe(false);
  });

  it('matches when provider + modelId both equal', () => {
    expect(matchesProvider({ provider: 'openai', modelId: 'gpt-4o' }, { provider: 'openai', modelId: 'gpt-4o' })).toBe(
      true,
    );
  });

  it('does not match when modelId differs', () => {
    expect(
      matchesProvider({ provider: 'openai', modelId: 'gpt-4o' }, { provider: 'openai', modelId: 'gpt-4o-mini' }),
    ).toBe(false);
  });

  it('matches a custom-tagged entry by exact provider', () => {
    const entry: ProviderModelEntry = { kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' };
    expect(matchesProvider(entry, { provider: 'acme/custom', modelId: 'foo-1' })).toBe(true);
    expect(matchesProvider(entry, { provider: 'acme/custom', modelId: 'foo-2' })).toBe(false);
  });
});

describe('isModelAllowed', () => {
  it('returns true when allowlist is undefined (unrestricted)', () => {
    expect(isModelAllowed(undefined, { provider: 'openai', modelId: 'gpt-4o' })).toBe(true);
  });

  it('returns true when allowlist is empty (unrestricted)', () => {
    expect(isModelAllowed([], { provider: 'openai', modelId: 'gpt-4o' })).toBe(true);
  });

  it('accepts a model whose provider is wildcarded', () => {
    expect(isModelAllowed([{ provider: 'openai' }], { provider: 'openai', modelId: 'gpt-4o-mini' })).toBe(true);
  });

  it('rejects a model whose provider is not in the allowlist', () => {
    expect(isModelAllowed([{ provider: 'openai' }], { provider: 'anthropic', modelId: 'claude-opus-4-7' })).toBe(false);
  });

  it('accepts a model that matches an explicit entry', () => {
    expect(isModelAllowed([{ provider: 'openai', modelId: 'gpt-4o' }], { provider: 'openai', modelId: 'gpt-4o' })).toBe(
      true,
    );
  });

  it('rejects a model that does not match any explicit entry under the same provider', () => {
    expect(
      isModelAllowed([{ provider: 'openai', modelId: 'gpt-4o' }], { provider: 'openai', modelId: 'gpt-4o-mini' }),
    ).toBe(false);
  });

  it('handles multi-provider allowlists (any entry matches)', () => {
    const allowed: ProviderModelEntry[] = [
      { provider: 'openai', modelId: 'gpt-4o-mini' },
      { provider: 'anthropic', modelId: 'claude-opus-4-7' },
    ];
    expect(isModelAllowed(allowed, { provider: 'anthropic', modelId: 'claude-opus-4-7' })).toBe(true);
    expect(isModelAllowed(allowed, { provider: 'openai', modelId: 'gpt-4o-mini' })).toBe(true);
    expect(isModelAllowed(allowed, { provider: 'google', modelId: 'gemini-2.5-flash' })).toBe(false);
  });

  it('mixes wildcard and explicit entries', () => {
    const allowed: ProviderModelEntry[] = [
      { provider: 'openai' },
      { provider: 'anthropic', modelId: 'claude-opus-4-7' },
    ];
    expect(isModelAllowed(allowed, { provider: 'openai', modelId: 'whatever' })).toBe(true);
    expect(isModelAllowed(allowed, { provider: 'anthropic', modelId: 'claude-opus-4-7' })).toBe(true);
    expect(isModelAllowed(allowed, { provider: 'anthropic', modelId: 'claude-3-5-haiku-latest' })).toBe(false);
  });

  it('treats duplicate entries as equivalent to a single entry', () => {
    const allowed: ProviderModelEntry[] = [{ provider: 'openai' }, { provider: 'openai' }];
    expect(isModelAllowed(allowed, { provider: 'openai', modelId: 'gpt-4o' })).toBe(true);
  });

  it('keeps same-modelId distinct across different providers', () => {
    const allowed: ProviderModelEntry[] = [{ provider: 'openai' }];
    expect(isModelAllowed(allowed, { provider: 'anthropic', modelId: 'gpt-4o' })).toBe(false);
  });

  it('accepts a custom-tagged entry by exact provider+modelId', () => {
    const allowed: ProviderModelEntry[] = [{ kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' }];
    expect(isModelAllowed(allowed, { provider: 'acme/custom', modelId: 'foo-1' })).toBe(true);
  });

  it('denies everything when every entry has an unknown non-custom provider', () => {
    // Typo / disabled provider should NOT silently allow everything.
    const allowed: ProviderModelEntry[] = [
      // Cast through unknown so the typed `Provider` union doesn't reject the typo.
      { provider: 'openaii' as unknown as 'openai' },
      { provider: 'antropic' as unknown as 'anthropic' },
    ];
    expect(isModelAllowed(allowed, { provider: 'openai', modelId: 'gpt-4o' })).toBe(false);
    expect(isModelAllowed(allowed, { provider: 'anthropic', modelId: 'claude-opus-4-7' })).toBe(false);
  });

  it('still applies the allowlist when only some entries are unknown providers', () => {
    const allowed: ProviderModelEntry[] = [{ provider: 'openaii' as unknown as 'openai' }, { provider: 'anthropic' }];
    expect(isModelAllowed(allowed, { provider: 'anthropic', modelId: 'claude-opus-4-7' })).toBe(true);
    expect(isModelAllowed(allowed, { provider: 'openai', modelId: 'gpt-4o' })).toBe(false);
  });

  it('treats custom-tagged entries as active even when the provider id is not registered', () => {
    const allowed: ProviderModelEntry[] = [{ kind: 'custom', provider: 'acme/custom', modelId: 'foo-1' }];
    expect(isModelAllowed(allowed, { provider: 'acme/custom', modelId: 'foo-1' })).toBe(true);
    expect(isModelAllowed(allowed, { provider: 'openai', modelId: 'gpt-4o' })).toBe(false);
  });
});

describe('enforceModelAllowlist', () => {
  it('passes when input is null/undefined (no candidates)', () => {
    expect(enforceModelAllowlist([{ provider: 'openai' }], null).ok).toBe(true);
    expect(enforceModelAllowlist([{ provider: 'openai' }], undefined).ok).toBe(true);
  });

  it('passes when allowlist is undefined', () => {
    expect(enforceModelAllowlist(undefined, 'openai/gpt-4o').ok).toBe(true);
  });

  it('passes a string model that is on the allowlist', () => {
    expect(enforceModelAllowlist([{ provider: 'openai' }], 'openai/gpt-4o-mini').ok).toBe(true);
  });

  it('rejects a string model that is not on the allowlist and includes a label', () => {
    const result = enforceModelAllowlist([{ provider: 'openai' }], 'anthropic/claude-opus-4-7');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempted.provider).toBe('anthropic');
      expect(result.attempted.modelId).toBe('claude-opus-4-7');
      expect(result.offendingLabel).toBe('anthropic/claude-opus-4-7');
    }
  });

  it('rejects on the FIRST disallowed candidate when input is a conditional list', () => {
    const allowed: ProviderModelEntry[] = [{ provider: 'openai' }];
    const conditional: ModelCandidateInput = [
      { value: 'openai/gpt-4o', rules: { operator: 'AND', conditions: [] } },
      { value: 'anthropic/claude-opus-4-7' }, // rule-less default — disallowed
    ] as unknown as ModelCandidateInput;
    const result = enforceModelAllowlist(allowed, conditional);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempted.provider).toBe('anthropic');
      expect(result.offendingLabel).toContain('variant[1]');
    }
  });

  it('passes when every conditional variant is allowed', () => {
    const allowed: ProviderModelEntry[] = [{ provider: 'openai' }, { provider: 'anthropic' }];
    const conditional: ModelCandidateInput = [
      { value: 'openai/gpt-4o', rules: { operator: 'AND', conditions: [] } },
      { value: 'anthropic/claude-opus-4-7' },
    ] as unknown as ModelCandidateInput;
    expect(enforceModelAllowlist(allowed, conditional).ok).toBe(true);
  });

  it('passes for dynamic-function inputs (deferred to runtime defense)', () => {
    expect(enforceModelAllowlist([{ provider: 'openai' }], () => 'anthropic/claude-opus-4-7').ok).toBe(true);
  });
});
