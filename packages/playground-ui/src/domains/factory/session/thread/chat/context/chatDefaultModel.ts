import { defaultModelPack } from '@internal/factory-contract';
import type {
  ModelPackSet,
  FactoryModelScope,
  FactoryProject,
  PersonalModelDefaultsResponse,
} from '@internal/factory-contract';

import type { AvailableModelsTarget } from '@mastra/react/hooks/factory';

const NO_MODEL_PACKS: ModelPackSet = { modelPacks: [], defaultModelPackId: null };

export function routedModelDefaults(
  modelScope: FactoryModelScope | undefined,
  project: Pick<FactoryProject, 'modelPacks' | 'defaultModelPackId'> | undefined,
  personal: PersonalModelDefaultsResponse | undefined,
): ModelPackSet {
  if (modelScope !== 'factory') {
    if (!personal) return NO_MODEL_PACKS;
    return { modelPacks: personal.modelPacks, defaultModelPackId: personal.defaultModelPackId };
  }
  if (!project) return NO_MODEL_PACKS;
  return { modelPacks: project.modelPacks ?? [], defaultModelPackId: project.defaultModelPackId ?? null };
}

export function routedDefaultModelId(defaults: ModelPackSet): string | undefined {
  return defaultModelPack(defaults)?.models[0]?.modelId;
}

export function newChatCatalogTarget(
  chatScope: FactoryModelScope | undefined,
  factoryId: string | undefined,
): AvailableModelsTarget {
  return chatScope === 'user' ? { scope: 'user' } : { factoryProjectId: factoryId };
}
