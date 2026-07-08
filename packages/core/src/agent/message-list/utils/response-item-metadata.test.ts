/**
 * Tests for packages/core/src/agent/message-list/utils/response-item-metadata.ts
 *
 * These are pure functions over `providerMetadata` objects with no I/O and
 * no async behaviour. Coverage focuses on the documented edge cases: the
 * Azure/OpenAI namespace-collision merge, provider-key formatting, and
 * empty/missing metadata handling.
 */
import { describe, expect, it } from 'vitest';

import {
  getResponseProviderItemId,
  getResponseProviderItemIds,
  getResponseProviderItemKey,
  getResponseProviderItemKeys,
} from './response-item-metadata';

describe('getResponseProviderItemIds', () => {
  it('returns an empty array when providerMetadata is undefined', () => {
    expect(getResponseProviderItemIds(undefined)).toEqual([]);
  });

  it('returns an empty array when providerMetadata is an empty object', () => {
    expect(getResponseProviderItemIds({})).toEqual([]);
  });

  it('extracts a single openai item id', () => {
    const metadata = { openai: { itemId: 'resp_openai_1' } };

    expect(getResponseProviderItemIds(metadata)).toEqual([{ provider: 'openai', itemId: 'resp_openai_1' }]);
  });

  it('extracts a single azure item id', () => {
    const metadata = { azure: { itemId: 'resp_azure_1' } };

    expect(getResponseProviderItemIds(metadata)).toEqual([{ provider: 'azure', itemId: 'resp_azure_1' }]);
  });

  it('collapses azure and openai into a single entry when their item ids match', () => {
    const metadata = { azure: { itemId: 'same-id' }, openai: { itemId: 'same-id' } };

    expect(getResponseProviderItemIds(metadata)).toEqual([{ provider: 'azure', itemId: 'same-id' }]);
  });

  it('returns both entries, in provider-list order (openai before azure), when item ids differ', () => {
    const metadata = { azure: { itemId: 'azure-id' }, openai: { itemId: 'openai-id' } };

    expect(getResponseProviderItemIds(metadata)).toEqual([
      { provider: 'openai', itemId: 'openai-id' },
      { provider: 'azure', itemId: 'azure-id' },
    ]);
  });

  it('ignores non-string itemId values', () => {
    const metadata = { openai: { itemId: 123 } };

    expect(getResponseProviderItemIds(metadata)).toEqual([]);
  });

  it('ignores providers outside the known provider list', () => {
    const metadata = { anthropic: { itemId: 'resp_anthropic_1' } };

    expect(getResponseProviderItemIds(metadata)).toEqual([]);
  });

  it('ignores a provider namespace with a missing itemId', () => {
    const metadata = { openai: {} };

    expect(getResponseProviderItemIds(metadata)).toEqual([]);
  });
});

describe('getResponseProviderItemId', () => {
  it('returns the first matching provider/item pair (openai, per provider-list order)', () => {
    const metadata = { azure: { itemId: 'azure-id' }, openai: { itemId: 'openai-id' } };

    expect(getResponseProviderItemId(metadata)).toEqual({ provider: 'openai', itemId: 'openai-id' });
  });

  it('returns undefined when there is no matching provider metadata', () => {
    expect(getResponseProviderItemId(undefined)).toBeUndefined();
    expect(getResponseProviderItemId({})).toBeUndefined();
  });
});

describe('getResponseProviderItemKey', () => {
  it('formats the key as "<provider>:<itemId>"', () => {
    const metadata = { openai: { itemId: 'abc123' } };

    expect(getResponseProviderItemKey(metadata)).toBe('openai:abc123');
  });

  it('returns undefined when there is no item id to key on', () => {
    expect(getResponseProviderItemKey(undefined)).toBeUndefined();
    expect(getResponseProviderItemKey({})).toBeUndefined();
  });

  it('keeps azure and openai keys distinct even for coincidentally equal ids', () => {
    // Namespace must remain in the key so matching Azure/OpenAI ids from two
    // *different* logical items never collide when compared independently.
    const azureKey = getResponseProviderItemKey({ azure: { itemId: 'shared-id' } });
    const openaiKey = getResponseProviderItemKey({ openai: { itemId: 'shared-id' } });

    expect(azureKey).toBe('azure:shared-id');
    expect(openaiKey).toBe('openai:shared-id');
    expect(azureKey).not.toBe(openaiKey);
  });
});

describe('getResponseProviderItemKeys', () => {
  it('formats keys for every extracted provider/item pair, in provider-list order', () => {
    const metadata = { azure: { itemId: 'azure-id' }, openai: { itemId: 'openai-id' } };

    expect(getResponseProviderItemKeys(metadata)).toEqual(['openai:openai-id', 'azure:azure-id']);
  });

  it('returns an empty array when there is nothing to key', () => {
    expect(getResponseProviderItemKeys(undefined)).toEqual([]);
  });

  it('returns a single collapsed key when azure and openai share an item id', () => {
    const metadata = { azure: { itemId: 'same-id' }, openai: { itemId: 'same-id' } };

    expect(getResponseProviderItemKeys(metadata)).toEqual(['azure:same-id']);
  });
});
