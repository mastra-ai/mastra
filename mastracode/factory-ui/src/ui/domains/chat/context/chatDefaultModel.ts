import { defaultModelPack } from '@mastra/factory/model-packs';
import type { ModelPackSet } from '@mastra/factory/model-packs';
import type { PersonalModelDefaultsResponse } from '@mastra/factory/routes/config';

import type { AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import type { FactoryModelScope, FactoryProject } from '../../workspaces/services/github';

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
