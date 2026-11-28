export const DEFAULT_MODEL_SELECTION: ModelSelectionRequest = { kind: 'default' };

export function readModelSelection(value: unknown): ModelSelectionRequest | undefined {
  const parsed = modelSelectionRequestSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function selectionPack(selection: ModelSelectionRequest, set: ModelPackSet): ModelPack | undefined {
  if (selection.kind === 'model') return undefined;
  const picked = selection.kind === 'pack' ? set.modelPacks.find(pack => pack.id === selection.packId) : undefined;
  return picked ?? defaultModelPack(set);
}
import { defaultModelPack, modelSelectionRequestSchema } from '@internal/factory-contract';
import type { ModelPack, ModelPackSet, ModelSelectionRequest } from '@internal/factory-contract';
