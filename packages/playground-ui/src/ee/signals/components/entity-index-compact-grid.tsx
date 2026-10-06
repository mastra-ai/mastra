import type { ThemeLearningEntity } from '@mastra/client-js';
import { useId } from 'react';

import { entityIndexMetadata } from './entity-index-model';
import { EntityIndexStatus } from './entity-index-status';
import { Card, CardContent, CardDescription, CardLink, CardTitle } from '@/ds/components/Card';
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
  return (
    <div className="group/entity relative h-full min-w-0" data-entity-card>
      {entity.status === 'collecting' ? (
        <Card className="absolute inset-0" />
      ) : (
        <CardLink
          LinkComponent={LinkComponent}
          href={getEntityHref(entity)}
          aria-label={`Open agent ${entity.entityId}`}
          aria-describedby={detailsId}
          className="absolute inset-0"
        />
      )}
      <CardContent density="compact" className="pointer-events-none relative grid h-full min-w-0 gap-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle title={entity.entityId} className="overflow-clip text-ellipsis whitespace-nowrap">
              {entity.entityId}
            </CardTitle>
            <CardDescription>{entity.entityType}</CardDescription>
          </div>
          <div className="pointer-events-auto">
            <EntityIndexStatus entity={entity} />
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
    return (
      <Txt variant="caption" tone="muted" className="py-8 text-center">
        No agents match your search
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
