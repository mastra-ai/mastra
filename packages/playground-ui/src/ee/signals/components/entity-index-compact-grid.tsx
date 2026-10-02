import type { ThemeLearningEntity } from '@mastra/client-js';
import { useId } from 'react';

import { entityIndexMetadata, entityStatusLabel } from './entity-index-model';
import { Badge } from '@/ds/components/Badge';
import { CardContent, CardDescription, CardLink, CardTitle } from '@/ds/components/Card';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Txt } from '@/ds/components/Txt';
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
        aria-label={`Open ${entity.entityId}`}
        aria-describedby={detailsId}
        className="absolute inset-0 group-focus-within/entity:bg-fill-subtle group-hover/entity:bg-fill-subtle"
      />
      <CardContent density="compact" className="pointer-events-none relative grid h-full min-w-0 gap-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle title={entity.entityId} className="overflow-clip text-ellipsis whitespace-nowrap">
              {entity.entityId}
            </CardTitle>
            <CardDescription>{entity.entityType}</CardDescription>
          </div>
          <Badge variant={statusVariant} size="sm" indicator={metadata.status === undefined ? undefined : 'dot'}>
            {statusLabel}
          </Badge>
        </div>
        <dl id={detailsId} className="grid grid-cols-3 gap-3">
          <div>
            <Txt as="dt" variant="meta" tone="muted">
              Traces
            </Txt>
            <Txt as="dd" variant="caption" tone="ink">
              {metadata.traceCount}
            </Txt>
          </div>
          <div>
            <Txt as="dt" variant="meta" tone="muted">
              Signals set
            </Txt>
            <Txt as="dd" variant="caption" tone="ink">
              {metadata.signalsSet}
            </Txt>
          </div>
          <div>
            <Txt as="dt" variant="meta" tone="muted">
              Updated
            </Txt>
            <Txt as="dd" variant="caption" tone="ink" title={entity.updatedAt}>
              {metadata.updatedAt}
            </Txt>
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
    return (
      <Txt variant="caption" tone="muted" className="py-8 text-center">
        No entities match your search
      </Txt>
    );
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
