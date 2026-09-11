const RESPONSE_ITEM_ID_PROVIDERS = ['openai', 'azure'] as const;

export type ResponseItemIdProvider = (typeof RESPONSE_ITEM_ID_PROVIDERS)[number];

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

export function getResponseProviderItemKeys(providerMetadata: Record<string, unknown> | undefined): string[] {
  return getResponseProviderItemIds(providerMetadata).map(({ provider, itemId }) =>
    formatResponseProviderItemKey(provider, itemId),
  );
}

/**
 * Provider namespaces whose AI SDK options declare `previousResponseId`, i.e. providers
 * that can be asked to restore prior conversation state server-side.
 *
 * Distinct from RESPONSE_ITEM_ID_PROVIDERS: that list is where Mastra persists item ids,
 * this one is where a caller can hand history ownership to the provider. `azure` is
 * included even though it declares no `previousResponseId` of its own, because
 * mirrorAzureProviderOptionsForOpenAI (llm/model/gateways/azure.ts) spreads `azure.*` into
 * `openai.*` only at gateway time — after memory recall has already run.
 */
const RESPONSE_CHAIN_PROVIDERS = ['openai', 'azure', 'xai'] as const;

/**
 * Whether the caller asked a provider to continue an existing server-side response chain.
 *
 * When true, replaying thread history from memory duplicates state the provider already
 * holds. Recalled assistant parts carry a persisted Responses `itemId`, which the provider
 * SDK converts to an `item_reference` alongside `previous_response_id` — OpenAI rejects
 * that combination with `400 Duplicate item found`.
 *
 * Only a non-empty string counts as set: the OpenAI schema types this option as
 * `ZodOptional<ZodNullable<ZodString>>`, so `null` and `undefined` both mean "no chain".
 */
export function hasProviderSideResponseChain(providerOptions: unknown): boolean {
  if (!providerOptions || typeof providerOptions !== 'object') return false;

  const options = providerOptions as Record<string, unknown>;

  return RESPONSE_CHAIN_PROVIDERS.some(provider => {
    const providerOptionsForNamespace = options[provider] as Record<string, unknown> | undefined;
    const previousResponseId = providerOptionsForNamespace?.previousResponseId;
    return typeof previousResponseId === 'string' && previousResponseId.length > 0;
  });
}
