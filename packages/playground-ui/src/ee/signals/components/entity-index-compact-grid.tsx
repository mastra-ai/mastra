import type { ThemeLearningEntity } from '@mastra/client-js';
import { useId } from 'react';

import { entityIndexMetadata, entityStatusLabel } from './entity-index-model';
import { CardContent, CardDescription, CardLink, CardTitle } from '@/ds/components/Card';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { StatusBadge } from '@/ds/components/StatusBadge';
import type { LinkComponent } from '@/ds/types/link-component';

export interface EntityIndexCompactGridProps {
  entities: readonly ThemeLearningEntity[];
  hasSearch: boolean;
  getEntityHref: (entity: ThemeLearningEntity) => string;
  LinkComponent: LinkComponent;
}

function EntityIndexCompactCard({
  entity,
  getEntityHref,
  LinkComponent,
}: {
  entity: ThemeLearningEntity;
  getEntityHref: (entity: ThemeLearningEntity) => string;
  LinkComponent: LinkComponent;
}) {
  const detailsId = useId();
  const metadata = entityIndexMetadata(entity);
  const statusLabel = entityStatusLabel(metadata.status);
  const statusVariant = metadata.status === 'ready' ? 'success' : metadata.status === 'processing' ? 'info' : 'neutral';
  return (
    <div className="group/entity relative h-full min-w-0" data-entity-card>
      <CardLink
        LinkComponent={LinkComponent}
        href={getEntityHref(entity)}
        appearance="surface"
        aria-label={`Open ${entity.entityId}`}
        aria-describedby={detailsId}
        className="group-focus-within/entity:bg-surface4 group-hover/entity:bg-surface4 absolute inset-0"
      />
      <CardContent density="compact" className="pointer-events-none relative grid h-full min-w-0 gap-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle title={entity.entityId} className="overflow-clip text-ellipsis whitespace-nowrap">
              {entity.entityId}
            </CardTitle>
            <CardDescription>{entity.entityType}</CardDescription>
          </div>
          <StatusBadge variant={statusVariant} size="sm" withDot={metadata.status !== undefined}>
            {statusLabel}
          </StatusBadge>
        </div>
        <dl id={detailsId} className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-ui-xs text-neutral3">Traces</dt>
            <dd className="text-ui-sm text-neutral5">{metadata.traceCount}</dd>
          </div>
          <div>
            <dt className="text-ui-xs text-neutral3">Signals set</dt>
            <dd className="text-ui-sm text-neutral5">{metadata.signalsSet}</dd>
          </div>
          <div>
            <dt className="text-ui-xs text-neutral3">Updated</dt>
            <dd className="text-ui-sm text-neutral5" title={entity.updatedAt}>
              {metadata.updatedAt}
            </dd>
          </div>
        </dl>
      </CardContent>
    </div>
  );
}

export function EntityIndexCompactGrid({
  entities,
  hasSearch,
  getEntityHref,
  LinkComponent,
}: EntityIndexCompactGridProps) {
  if (entities.length === 0 && hasSearch) {
    return <p className="text-ui-sm text-neutral3 py-8 text-center">No entities match your search</p>;
  }
  return (
    <ScrollArea className="h-full">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {entities.map(entity => (
          <EntityIndexCompactCard
            key={`${entity.entityType}:${entity.entityId}`}
            entity={entity}
            getEntityHref={getEntityHref}
            LinkComponent={LinkComponent}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
