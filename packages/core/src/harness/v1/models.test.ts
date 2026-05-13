/**
 * Harness v1 — `harness.models.*` catalog + auth-status surface (§9).
 *
 * The catalog is a static UX surface: UIs render a picker and an
 * auth-status pill against it. The harness does not validate the catalog
 * against agents / modes — it only stores entries and resolves lookups.
 *
 * These tests pin:
 *   - construction-time validation (duplicate ids, missing required fields)
 *   - `list()` snapshot semantics (declaration order, frozen)
 *   - `get()` lookup including miss → null
 *   - `getAuthStatus()` resolver wiring, async-resolver support,
 *     unknown-id rejection, and `'unknown'` fallback when no resolver
 *   - empty-catalog behavior (no models configured)
 */

import { describe, expect, it } from 'vitest';

import { setupHarness } from './__test-utils__';
import { HarnessConfigError, HarnessModelNotFoundError } from './errors';

const SAMPLE_CATALOG = [
  {
    id: 'anthropic/claude-sonnet-4',
    providerId: 'anthropic',
    displayName: 'Claude Sonnet 4',
    contextWindow: 200_000,
    capabilities: ['vision', 'tools'] as const,
    metadata: { tier: 'flagship' },
  },
  {
    id: 'openai/gpt-5',
    providerId: 'openai',
    displayName: 'GPT-5',
  },
];

describe('harness.models — construction validation', () => {
  it('throws HarnessConfigError on duplicate model id', () => {
    expect(() =>
      setupHarness({
        models: [
          { id: 'm1', providerId: 'p' },
          { id: 'm1', providerId: 'p' },
        ],
      }),
    ).toThrow(HarnessConfigError);
  });

  it('throws when an entry is missing a non-empty `id`', () => {
    expect(() =>
      // @ts-expect-error testing runtime guard
      setupHarness({ models: [{ providerId: 'p' }] }),
    ).toThrow(HarnessConfigError);
    expect(() => setupHarness({ models: [{ id: '', providerId: 'p' }] })).toThrow(HarnessConfigError);
  });

  it('throws when an entry is missing a non-empty `providerId`', () => {
    expect(() =>
      // @ts-expect-error testing runtime guard
      setupHarness({ models: [{ id: 'm1' }] }),
    ).toThrow(HarnessConfigError);
    expect(() => setupHarness({ models: [{ id: 'm1', providerId: '' }] })).toThrow(HarnessConfigError);
  });

  it('throws when `models` is not an array', () => {
    expect(() =>
      // @ts-expect-error testing runtime guard
      setupHarness({ models: { id: 'm1', providerId: 'p' } }),
    ).toThrow(HarnessConfigError);
  });
});

describe('harness.models.list()', () => {
  it('returns entries in declaration order', async () => {
    const { harness } = setupHarness({ models: SAMPLE_CATALOG });
    const out = await harness.models.list();
    expect(out.map(m => m.id)).toEqual(['anthropic/claude-sonnet-4', 'openai/gpt-5']);
  });

  it('returns a frozen snapshot', async () => {
    const { harness } = setupHarness({ models: SAMPLE_CATALOG });
    const out = await harness.models.list();
    expect(Object.isFrozen(out)).toBe(true);
  });

  it('returns an empty array when no catalog is configured', async () => {
    const { harness } = setupHarness();
    expect(await harness.models.list()).toEqual([]);
  });
});

describe('harness.models.get()', () => {
  it('returns the catalog entry verbatim', async () => {
    const { harness } = setupHarness({ models: SAMPLE_CATALOG });
    const entry = await harness.models.get('anthropic/claude-sonnet-4');
    expect(entry).not.toBeNull();
    expect(entry!.displayName).toBe('Claude Sonnet 4');
    expect(entry!.contextWindow).toBe(200_000);
    expect(entry!.metadata).toEqual({ tier: 'flagship' });
  });

  it('returns null for an unknown id', async () => {
    const { harness } = setupHarness({ models: SAMPLE_CATALOG });
    expect(await harness.models.get('does-not-exist')).toBeNull();
  });

  it('returns null when no catalog is configured', async () => {
    const { harness } = setupHarness();
    expect(await harness.models.get('anything')).toBeNull();
  });
});

describe('harness.models.getAuthStatus()', () => {
  it('delegates to the configured resolver', async () => {
    const seen: string[] = [];
    const { harness } = setupHarness({
      models: SAMPLE_CATALOG,
      modelAuthStatusResolver: modelId => {
        seen.push(modelId);
        return modelId === 'anthropic/claude-sonnet-4' ? 'authenticated' : 'needs_auth';
      },
    });

    await expect(harness.models.getAuthStatus('anthropic/claude-sonnet-4')).resolves.toBe('authenticated');
    await expect(harness.models.getAuthStatus('openai/gpt-5')).resolves.toBe('needs_auth');
    expect(seen).toEqual(['anthropic/claude-sonnet-4', 'openai/gpt-5']);
  });

  it('awaits an async resolver', async () => {
    const { harness } = setupHarness({
      models: SAMPLE_CATALOG,
      modelAuthStatusResolver: async () => 'authenticated' as const,
    });
    await expect(harness.models.getAuthStatus('openai/gpt-5')).resolves.toBe('authenticated');
  });

  it("returns 'unknown' when no resolver is configured", async () => {
    const { harness } = setupHarness({ models: SAMPLE_CATALOG });
    await expect(harness.models.getAuthStatus('openai/gpt-5')).resolves.toBe('unknown');
  });

  it('throws HarnessModelNotFoundError for an id outside the catalog', async () => {
    const { harness } = setupHarness({
      models: SAMPLE_CATALOG,
      modelAuthStatusResolver: () => 'authenticated',
    });
    await expect(harness.models.getAuthStatus('not-in-catalog')).rejects.toBeInstanceOf(HarnessModelNotFoundError);
  });

  it('throws HarnessModelNotFoundError when the catalog is empty', async () => {
    const { harness } = setupHarness();
    await expect(harness.models.getAuthStatus('anything')).rejects.toBeInstanceOf(HarnessModelNotFoundError);
  });

  it('re-invokes the resolver on each call (no caching)', async () => {
    let callCount = 0;
    const { harness } = setupHarness({
      models: SAMPLE_CATALOG,
      modelAuthStatusResolver: () => {
        callCount += 1;
        return callCount === 1 ? 'needs_auth' : 'authenticated';
      },
    });

    await expect(harness.models.getAuthStatus('openai/gpt-5')).resolves.toBe('needs_auth');
    await expect(harness.models.getAuthStatus('openai/gpt-5')).resolves.toBe('authenticated');
    expect(callCount).toBe(2);
  });
});
