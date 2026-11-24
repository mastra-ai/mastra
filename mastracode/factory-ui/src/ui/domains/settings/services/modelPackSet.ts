import type { ModelPack, ModelPackSet } from '@mastra/factory/model-packs';

export function withPackSaved(set: ModelPackSet, pack: ModelPack): ModelPackSet {
  const exists = set.modelPacks.some(existing => existing.id === pack.id);
  return {
    modelPacks: exists
      ? set.modelPacks.map(existing => (existing.id === pack.id ? pack : existing))
      : [...set.modelPacks, pack],
    defaultModelPackId: set.defaultModelPackId ?? pack.id,
  };
}

export function withPackRemoved(set: ModelPackSet, packId: string): ModelPackSet {
  const modelPacks = set.modelPacks.filter(pack => pack.id !== packId);
  const keepsDefault = modelPacks.some(pack => pack.id === set.defaultModelPackId);
  return {
    modelPacks,
    defaultModelPackId: keepsDefault ? set.defaultModelPackId : (modelPacks[0]?.id ?? null),
  };
}

export function modelPackNameError(set: ModelPackSet, name: string, packId?: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return 'Give the pack a name';
  if (set.modelPacks.some(pack => pack.id !== packId && pack.name.trim().toLowerCase() === wanted)) {
    return 'Another pack already has this name';
  }
  return undefined;
}
