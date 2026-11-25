import { isThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { defaultModelPack } from '@mastra/factory/model-packs';
import type { ModelPack, ModelPackSet, ModelSelectionRequest } from '@mastra/factory/model-packs';
import { z } from 'zod';

export const DEFAULT_MODEL_SELECTION: ModelSelectionRequest = { kind: 'default' };

const modelSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('default') }),
  z.object({ kind: z.literal('pack'), packId: z.string() }),
  z.object({
    kind: z.literal('model'),
    modelId: z.string(),
    thinkingLevel: z.custom<ThinkingLevelSetting>(isThinkingLevelSetting).optional(),
  }),
]);

export function readModelSelection(value: unknown): ModelSelectionRequest | undefined {
  const parsed = modelSelectionSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function selectionPack(selection: ModelSelectionRequest, set: ModelPackSet): ModelPack | undefined {
  if (selection.kind === 'model') return undefined;
  const picked = selection.kind === 'pack' ? set.modelPacks.find(pack => pack.id === selection.packId) : undefined;
  return picked ?? defaultModelPack(set);
}
