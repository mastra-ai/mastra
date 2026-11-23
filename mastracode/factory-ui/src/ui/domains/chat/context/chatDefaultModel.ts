import type { AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import type { FactoryModelScope } from '../../workspaces/services/github';

interface ScopedDefaults<T> {
  factory: T | null | undefined;
  personal: T | null | undefined;
}

export function routedDefault<T>(
  modelScope: FactoryModelScope | undefined,
  defaults: ScopedDefaults<T>,
): T | undefined {
  return (modelScope === 'factory' ? defaults.factory : defaults.personal) ?? undefined;
}

export function newChatCatalogTarget(
  chatScope: FactoryModelScope | undefined,
  factoryId: string | undefined,
): AvailableModelsTarget {
  return chatScope === 'user' ? { scope: 'user' } : { factoryProjectId: factoryId };
}
