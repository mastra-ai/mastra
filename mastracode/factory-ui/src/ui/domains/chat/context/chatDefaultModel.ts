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

export function chatStartModelId(
  modelScope: FactoryModelScope | undefined,
  defaults: ScopedDefaultModels,
): string | undefined {
  return routedDefaultModelId(modelScope, defaults) ?? defaults.factory ?? undefined;
}
