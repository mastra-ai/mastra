import { defaultModelPack } from '@mastra/factory/model-packs';
import type { ModelPackSet } from '@mastra/factory/model-packs';
import type { PersonalModelDefaultsResponse } from '@mastra/factory/routes/config';

import type { AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import type { FactoryModelScope, FactoryProject } from '../../workspaces/services/github';

export interface RoutedModelDefaults extends ModelPackSet {
  defaultModelId: string | null;
}

const NO_MODEL_DEFAULTS: RoutedModelDefaults = { modelPacks: [], defaultModelPackId: null, defaultModelId: null };

export function routedModelDefaults(
  modelScope: FactoryModelScope | undefined,
  project: Pick<FactoryProject, 'modelPacks' | 'defaultModelPackId' | 'defaultModelId'> | undefined,
  personal: PersonalModelDefaultsResponse | undefined,
): RoutedModelDefaults {
  if (modelScope !== 'factory') {
    if (!personal) return NO_MODEL_DEFAULTS;
    return {
      modelPacks: personal.modelPacks,
      defaultModelPackId: personal.defaultModelPackId,
      defaultModelId: personal.modelId,
    };
  }
  if (!project) return NO_MODEL_DEFAULTS;
  return {
    modelPacks: project.modelPacks ?? [],
    defaultModelPackId: project.defaultModelPackId ?? null,
    defaultModelId: project.defaultModelId ?? null,
  };
}

export function routedDefaultModelId(defaults: RoutedModelDefaults): string | undefined {
  return defaultModelPack(defaults)?.models[0]?.modelId ?? defaults.defaultModelId ?? undefined;
}

export function newChatCatalogTarget(
  chatScope: FactoryModelScope | undefined,
  factoryId: string | undefined,
): AvailableModelsTarget {
  return chatScope === 'user' ? { scope: 'user' } : { factoryProjectId: factoryId };
}
