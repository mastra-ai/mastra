import type { EntityLearningProgressStatus, ThemeLearningEntity } from '@mastra/client-js';

export type TraceIntelligenceEntitySort = 'default' | 'entity-asc' | 'entity-desc';
export type TraceIntelligenceEntityView = 'compact' | 'list';

export type EntityIndexMetadata = {
  traceCount: string;
  signalsSet: string;
  status?: EntityLearningProgressStatus;
  updatedAt: string;
};

export function filterAndSortEntities(
  entities: readonly ThemeLearningEntity[],
  search: string,
  sort: TraceIntelligenceEntitySort,
): ThemeLearningEntity[] {
  const term = search.trim().toLocaleLowerCase();
  const filtered = term
    ? entities.filter(entity => `${entity.entityType} ${entity.entityId}`.toLocaleLowerCase().includes(term))
    : [...entities];
  if (sort === 'default') return filtered;

  const direction = sort === 'entity-asc' ? 1 : -1;
  return filtered.toSorted((left, right) => direction * left.entityId.localeCompare(right.entityId));
}

export function entityIndexMetadata(entity: ThemeLearningEntity): EntityIndexMetadata {
  const enabledCatalog = entity.signalCatalog?.filter(signal => signal.enabled);
  const enabledSignalCount = entity.enabledSignalCount ?? enabledCatalog?.length;
  const readySignalCount =
    entity.readySignalCount ?? enabledCatalog?.filter(signal => signal.status === 'ready').length;
  return {
    traceCount: entity.traceCount === undefined ? '—' : new Intl.NumberFormat('en-US').format(entity.traceCount),
    signalsSet:
      readySignalCount === undefined || enabledSignalCount === undefined
        ? '—'
        : `${readySignalCount} of ${enabledSignalCount}`,
    status: entity.status,
    updatedAt:
      entity.updatedAt === undefined
        ? '—'
        : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(entity.updatedAt),
          ),
  };
}

export function entityStatusLabel(status: EntityLearningProgressStatus | undefined): string {
  if (!status) return 'Unavailable';
  return status.charAt(0).toUpperCase() + status.slice(1);
}
