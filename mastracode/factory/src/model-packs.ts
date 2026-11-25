import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { z } from 'zod';

export const MODEL_PACK_MODELS_MAX = 4;
export const MODEL_PACKS_MAX = 8;
export const MODEL_PACK_NAME_MAX = 40;
export const FACTORY_MODEL_SELECTION_SETTING = 'factoryModelSelection';

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

export type StoredModelSelection = { kind: 'default' } | { kind: 'pack'; packId: string } | { kind: 'model' };

export type ModelSelection = { kind: 'pack'; pack: ModelPack } | { kind: 'model' };

export type ResolvedModelSelection = { kind: 'pack'; packId: string } | { kind: 'model' };

export type ModelSelectionRequest =
  | { kind: 'default' }
  | { kind: 'pack'; packId: string }
  | { kind: 'model'; modelId: string; thinkingLevel?: ThinkingLevelSetting };

const storedModelSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('default') }),
  z.object({ kind: z.literal('pack'), packId: z.string().min(1) }),
  z.object({ kind: z.literal('model') }),
]);

export interface DefaultModelChange {
  modelId?: string | null;
  thinkingLevel?: ThinkingLevelSetting;
}

export const LEGACY_MODEL_PACK_ID = 'default';
const LEGACY_MODEL_PACK_NAME = 'Default';

export const EMPTY_MODEL_PACK_SET: ModelPackSet = { modelPacks: [], defaultModelPackId: null };

export function defaultModelPack(set: ModelPackSet): ModelPack | undefined {
  return set.modelPacks.find(pack => pack.id === set.defaultModelPackId);
}

export function parseStoredModelSelection(value: unknown): StoredModelSelection | undefined {
  const parsed = storedModelSelectionSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function packSelection(pack: ModelPack | undefined): ModelSelection {
  return pack ? { kind: 'pack', pack } : { kind: 'model' };
}

export function resolveModelSelection(
  set: ModelPackSet,
  stored: StoredModelSelection | undefined,
  sessionModelId: string | undefined,
): ModelSelection {
  const defaultPack = defaultModelPack(set);
  if (!stored) {
    return defaultPack && defaultPack.models[0]?.modelId === sessionModelId
      ? packSelection(defaultPack)
      : { kind: 'model' };
  }
  if (stored.kind === 'model') return { kind: 'model' };
  if (stored.kind === 'default') return packSelection(defaultPack);
  return packSelection(set.modelPacks.find(pack => pack.id === stored.packId) ?? defaultPack);
}

export function resolvedModelSelection(selection: ModelSelection): ResolvedModelSelection {
  return selection.kind === 'pack' ? { kind: 'pack', packId: selection.pack.id } : { kind: 'model' };
}

export function legacyModelPackSet(modelId: string | null, thinkingLevel: ThinkingLevelSetting): ModelPackSet {
  if (!modelId) return { modelPacks: [], defaultModelPackId: null };
  return {
    modelPacks: [{ id: LEGACY_MODEL_PACK_ID, name: LEGACY_MODEL_PACK_NAME, models: [{ modelId, thinkingLevel }] }],
    defaultModelPackId: LEGACY_MODEL_PACK_ID,
  };
}

export function withDefaultModel(
  set: ModelPackSet,
  change: DefaultModelChange,
  newPackThinkingLevel: ThinkingLevelSetting,
): ModelPackSet {
  const pack = defaultModelPack(set);
  if (change.modelId === null) {
    if (!pack) return set;
    const modelPacks = set.modelPacks.filter(candidate => candidate.id !== pack.id);
    return { modelPacks, defaultModelPackId: modelPacks[0]?.id ?? null };
  }
  if (!pack) {
    return change.modelId === undefined
      ? set
      : legacyModelPackSet(change.modelId, change.thinkingLevel ?? newPackThinkingLevel);
  }
  const [first, ...rest] = pack.models;
  if (!first) return set;
  const head = {
    modelId: change.modelId ?? first.modelId,
    thinkingLevel: change.thinkingLevel ?? first.thinkingLevel,
  };
  const models = [head, ...rest.filter(model => model.modelId !== head.modelId)];
  return {
    ...set,
    modelPacks: set.modelPacks.map(candidate => (candidate.id === pack.id ? { ...pack, models } : candidate)),
  };
}
