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

export function newChatCatalogTarget(
  chatScope: FactoryModelScope | undefined,
  factoryId: string | undefined,
): AvailableModelsTarget {
  return chatScope === 'user' ? { scope: 'user' } : { factoryProjectId: factoryId };
}
