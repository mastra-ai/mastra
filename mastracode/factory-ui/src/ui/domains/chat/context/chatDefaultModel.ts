import type { AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import type { FactoryModelScope } from '../../workspaces/services/github';

interface ScopedDefaultModels {
  factory: string | null | undefined;
  personal: string | null | undefined;
}

export function routedDefaultModelId(
  modelScope: FactoryModelScope | undefined,
  defaults: ScopedDefaultModels,
): string | undefined {
  return (modelScope === 'factory' ? defaults.factory : defaults.personal) ?? undefined;
}

/** A hybrid Factory bills a draft by who it is for; otherwise the Factory's scope decides. */
export function draftModelScope(
  storedScope: FactoryModelScope | undefined,
  kind: 'user' | 'factory',
): Exclude<FactoryModelScope, 'hybrid'> | undefined {
  return storedScope === 'hybrid' ? kind : storedScope;
}

export function newChatCatalogTarget(
  chatScope: FactoryModelScope | undefined,
  factoryId: string | undefined,
): AvailableModelsTarget {
  return chatScope === 'user' ? { scope: 'user' } : { factoryProjectId: factoryId };
}
