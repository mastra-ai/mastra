import { THINKING_LEVEL_VALUES } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { z } from 'zod';

export const MODEL_PACK_MODELS_MAX = 4;
export const MODEL_PACKS_MAX = 8;
export const MODEL_PACK_NAME_MAX = 40;
export const FACTORY_MODEL_SELECTION_SETTING = 'factoryModelSelection';
export const MODEL_ID_PATTERN = /^[^\s/]+\/\S(?:.*\S)?$/;

export const modelIdSchema = z
  .string()
  .trim()
  .max(256)
  .regex(MODEL_ID_PATTERN, 'Use a provider/model ID, e.g. "anthropic/claude-opus-5.5"');

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

export type ResolvedModelSelection = { kind: 'pack'; packId: string } | { kind: 'model' };

const defaultSelectionSchema = z.object({ kind: z.literal('default') });
const packSelectionSchema = z.object({ kind: z.literal('pack'), packId: z.string().min(1) });
const modelSelectionSchema = z.object({ kind: z.literal('model') });

const storedModelSelectionSchema = z.discriminatedUnion('kind', [
  defaultSelectionSchema,
  packSelectionSchema,
  modelSelectionSchema,
]);

export type StoredModelSelection = z.infer<typeof storedModelSelectionSchema>;

export const modelSelectionRequestSchema = z.discriminatedUnion('kind', [
  defaultSelectionSchema,
  packSelectionSchema,
  modelSelectionSchema.extend({ modelId: modelIdSchema, thinkingLevel: z.enum(THINKING_LEVEL_VALUES).optional() }),
]);

export type ModelSelectionRequest = z.infer<typeof modelSelectionRequestSchema>;

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

export function resolveModelSelection(
  set: ModelPackSet,
  stored: StoredModelSelection | undefined,
  sessionModelId: string | undefined,
): ModelPack | undefined {
  const defaultPack = defaultModelPack(set);
  if (!stored) return defaultPack && defaultPack.models[0]?.modelId === sessionModelId ? defaultPack : undefined;
  if (stored.kind === 'model') return undefined;
  if (stored.kind === 'default') return defaultPack;
  return set.modelPacks.find(pack => pack.id === stored.packId) ?? defaultPack;
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
  modelId: string,
  newPackThinkingLevel: ThinkingLevelSetting,
): ModelPackSet {
  const pack = defaultModelPack(set);
  if (!pack) return legacyModelPackSet(modelId, newPackThinkingLevel);
  const [first, ...rest] = pack.models;
  const models = [
    { modelId, thinkingLevel: first?.thinkingLevel ?? newPackThinkingLevel },
    ...rest.filter(model => model.modelId !== modelId),
  ];
  return {
    ...set,
    modelPacks: set.modelPacks.map(candidate => (candidate.id === pack.id ? { ...pack, models } : candidate)),
  };
}
