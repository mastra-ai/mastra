export const RESPONSE_ITEM_ID_PROVIDERS = ['openai', 'azure'] as const;

export type ResponseItemIdProvider = (typeof RESPONSE_ITEM_ID_PROVIDERS)[number];

/**
 * Key under a provider namespace holding the item id of a tool RESULT when it
 * differs from the call's item id. Some hosted tools on the OpenAI Responses
 * API (e.g. `tool_search`) give the call and its output distinct item ids
 * (`tsc_…` / `tso_…`). A merged tool part only has one `itemId` slot, so the
 * result id is kept alongside it; prompt conversion splits them back so each
 * side replays as its own `item_reference` (referencing one id twice fails
 * with "Duplicate item found").
 */
export const RESPONSE_RESULT_ITEM_ID_KEY = 'resultItemId';

function formatResponseProviderItemKey(provider: ResponseItemIdProvider, itemId: string): string {
  // Keep the provider namespace in the key so matching Azure/OpenAI item IDs
  // cannot merge across provider-specific response streams.
  return `${provider}:${itemId}`;
}

export function getResponseProviderItemId(
  providerMetadata: Record<string, unknown> | undefined,
): { provider: ResponseItemIdProvider; itemId: string } | undefined {
  return getResponseProviderItemIds(providerMetadata)[0];
}

export function getResponseProviderItemKey(providerMetadata: Record<string, unknown> | undefined): string | undefined {
  const item = getResponseProviderItemId(providerMetadata);
  return item ? formatResponseProviderItemKey(item.provider, item.itemId) : undefined;
}

export function getResponseProviderItemIds(
  providerMetadata: Record<string, unknown> | undefined,
): Array<{ provider: ResponseItemIdProvider; itemId: string }> {
  if (!providerMetadata) return [];

  const azureMetadata = providerMetadata.azure as Record<string, unknown> | undefined;
  const azureItemId = azureMetadata?.itemId;
  const openaiMetadata = providerMetadata.openai as Record<string, unknown> | undefined;
  const openaiItemId = openaiMetadata?.itemId;
  if (typeof azureItemId === 'string' && azureItemId === openaiItemId) {
    return [{ provider: 'azure', itemId: azureItemId }];
  }

  // AI SDK Responses metadata is expected to use exactly one provider namespace
  // per part. If a future proxy adds both, keep this deterministic.
  return RESPONSE_ITEM_ID_PROVIDERS.flatMap(provider => {
    const metadata = providerMetadata[provider] as Record<string, unknown> | undefined;
    const itemId = metadata?.itemId;
    return typeof itemId === 'string' ? [{ provider, itemId }] : [];
  });
}

/**
 * Preserves both item ids when a tool-call part and its tool-result carry
 * DIFFERENT Responses item ids for the same provider namespace. Returns
 * `merged` with the namespace rewritten to `{ itemId: <call id>,
 * resultItemId: <result id> }`; a no-op (returns `merged` unchanged) when
 * either side lacks an item id or both sides share one.
 */
export function preserveResponseItemIdsOnMerge(
  callMetadata: Record<string, unknown> | undefined,
  resultMetadata: Record<string, unknown> | undefined,
  merged: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  let result = merged;
  for (const provider of RESPONSE_ITEM_ID_PROVIDERS) {
    const callItemId = (callMetadata?.[provider] as Record<string, unknown> | undefined)?.itemId;
    const resultItemId = (resultMetadata?.[provider] as Record<string, unknown> | undefined)?.itemId;
    if (typeof callItemId !== 'string' || typeof resultItemId !== 'string' || callItemId === resultItemId) {
      continue;
    }
    const namespace = (result?.[provider] ?? {}) as Record<string, unknown>;
    result = {
      ...result,
      [provider]: { ...namespace, itemId: callItemId, [RESPONSE_RESULT_ITEM_ID_KEY]: resultItemId },
    };
  }
  return result;
}

/**
 * Builds result-side provider metadata from a merged tool part's metadata:
 * `{ <provider>: { itemId: <resultItemId> } }` for each namespace carrying a
 * {@link RESPONSE_RESULT_ITEM_ID_KEY}. Returns undefined when no namespace
 * does (the common case — most tools share one item id across call/result).
 */
export function getResponseResultProviderMetadata(
  providerMetadata: Record<string, unknown> | undefined,
): Record<string, Record<string, unknown>> | undefined {
  if (!providerMetadata) return undefined;
  let result: Record<string, Record<string, unknown>> | undefined;
  for (const provider of RESPONSE_ITEM_ID_PROVIDERS) {
    const resultItemId = (providerMetadata[provider] as Record<string, unknown> | undefined)?.[
      RESPONSE_RESULT_ITEM_ID_KEY
    ];
    if (typeof resultItemId !== 'string') continue;
    result = { ...result, [provider]: { itemId: resultItemId } };
  }
  return result;
}

export function getResponseProviderItemKeys(providerMetadata: Record<string, unknown> | undefined): string[] {
  return getResponseProviderItemIds(providerMetadata).map(({ provider, itemId }) =>
    formatResponseProviderItemKey(provider, itemId),
  );
}
