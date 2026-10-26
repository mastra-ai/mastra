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
