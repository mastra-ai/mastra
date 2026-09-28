import type { ThemeLearningEntity } from '@mastra/client-js';
import { useId } from 'react';

import { entityIndexMetadata, entityStatusPresentation } from './entity-index-model';
import { CardContent, CardDescription, CardLink, CardTitle } from '@/ds/components/Card';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Status } from '@/ds/components/StatusIndicators';
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
          <div className="shrink-0 text-caption">
            <Status presentation={entityStatusPresentation(metadata.status)} />
          </div>
        </div>
        <dl id={detailsId} className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-meta text-muted-foreground">Traces</dt>
            <dd className="text-caption text-foreground">{metadata.traceCount}</dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Signals set</dt>
            <dd className="text-caption text-foreground">{metadata.signalsSet}</dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Updated</dt>
            <dd className="text-caption text-foreground" title={entity.updatedAt}>
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
    return <p className="py-8 text-center text-caption text-muted-foreground">No entities match your search</p>;
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
