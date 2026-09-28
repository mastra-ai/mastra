import type { EntityLearningProgressStatus, ThemeLearningEntity } from '@mastra/client-js';
import type { StatusPresentation } from '@/ds/components/StatusIndicators';
import { formatFullNumber } from '@/lib/cost';
import { formatDate } from '@/utils/date-format';

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
    traceCount: entity.traceCount === undefined ? '—' : formatFullNumber(entity.traceCount),
    signalsSet:
      readySignalCount === undefined || enabledSignalCount === undefined
        ? '—'
        : `${readySignalCount} of ${enabledSignalCount}`,
    status: entity.status,
    updatedAt: formatDate(entity.updatedAt, 'date-time') ?? '—',
  };
}

const entityStatusPresentations = {
  collecting: {
    label: 'Collecting',
    tone: 'neutral',
    glyph: 'ring',
    description: 'Gathering traces before signals can be learned.',
  },
  processing: { label: 'Processing', tone: 'progress', description: 'Learning signals from collected traces.' },
  ready: { label: 'Ready', tone: 'success', description: 'Signals are learned and up to date.' },
} satisfies Record<EntityLearningProgressStatus, StatusPresentation>;

const unavailableStatus: StatusPresentation = {
  label: 'Unavailable',
  tone: 'neutral',
  glyph: 'ring',
  description: 'Learning status isn’t available for this entity.',
};

export function entityStatusPresentation(status: EntityLearningProgressStatus | undefined): StatusPresentation {
  return status ? entityStatusPresentations[status] : unavailableStatus;
}
