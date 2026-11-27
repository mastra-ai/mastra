// UI-side shapes of Factory model packs. They mirror `@mastra/factory/model-packs`, which a UI package
// can't depend on; keep the limits and the model ID pattern in step with it.

export type ThinkingLevelSetting = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const THINKING_LEVEL_VALUES: readonly ThinkingLevelSetting[] = ['off', 'low', 'medium', 'high', 'xhigh', 'max'];

export const DEFAULT_THINKING_LEVEL: ThinkingLevelSetting = 'medium';

export const MODEL_PACK_MODELS_MAX = 4;
export const MODEL_PACKS_MAX = 8;
export const MODEL_PACK_NAME_MAX = 40;
export const MODEL_ID_PATTERN = /^[^\s/]+\/\S(?:.*\S)?$/;

export interface ModelPackModel {
  modelId: string;
  thinkingLevel: ThinkingLevelSetting;
}

export interface ModelPack {
  id: string;
  name: string;
  models: ModelPackModel[];
}

export interface ModelPackSet {
  modelPacks: ModelPack[];
  defaultModelPackId: string | null;
}

/** A model the pack editor can pick: `id` is `provider/model`. */
export interface AvailableModelOption {
  id: string;
  provider: string;
  modelName: string;
  releaseDate?: string;
}

export function defaultModelPack(set: ModelPackSet): ModelPack | undefined {
  return set.modelPacks.find(pack => pack.id === set.defaultModelPackId);
}

export const LEGACY_MODEL_PACK_ID = 'default';
const LEGACY_MODEL_PACK_NAME = 'Default';

/** A one-pack set holding `modelId`, the shape a Factory gets before anyone has made packs. */
export function legacyModelPackSet(modelId: string | null, thinkingLevel: ThinkingLevelSetting): ModelPackSet {
  if (!modelId) return { modelPacks: [], defaultModelPackId: null };
  return {
    modelPacks: [{ id: LEGACY_MODEL_PACK_ID, name: LEGACY_MODEL_PACK_NAME, models: [{ modelId, thinkingLevel }] }],
    defaultModelPackId: LEGACY_MODEL_PACK_ID,
  };
}
