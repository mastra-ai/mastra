import type { DefaultModelResponse } from '../../../../api/types';
import type { FactoryModelScope } from '../../workspaces/services/github';
import type { PersonalThinkingDefault } from '../services/thinkingLevels';

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

export function routedPersonalThinkingLevel(
  modelScope: FactoryModelScope | undefined,
  personalDefaults: DefaultModelResponse | undefined,
): PersonalThinkingDefault {
  if (modelScope === 'factory') return null;
  return personalDefaults?.thinkingLevel;
}
