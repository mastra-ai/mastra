import type { ThemeLearningEntity } from '@mastra/client-js';
import { useId } from 'react';

import { Card, CardContent, CardDescription, CardLink, CardTitle } from '../../../ds/components/Card';
import { ScrollArea } from '../../../ds/components/ScrollArea';
import { Txt } from '../../../ds/components/Txt';
import { textStyle } from '../../../ds/primitives/text';
import type { LinkComponent } from '../../../ds/types/link-component';
import { entityIndexMetadata } from './entity-index-model';
import { EntityIndexStatus } from './entity-index-status';

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
      {/* No signals yet means the detail page has nothing to show, so the card stays static. */}
      {entity.status === 'collecting' ? (
        <Card className="absolute inset-0" />
      ) : (
        <CardLink
          LinkComponent={LinkComponent}
          href={getEntityHref(entity)}
          aria-label={`Open ${entity.entityId}`}
          aria-describedby={detailsId}
          className="absolute inset-0 group-focus-within/entity:bg-fill-subtle group-hover/entity:bg-fill-subtle"
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
          <EntityIndexStatus entity={entity} />
        </div>
        <dl id={detailsId} className="grid grid-cols-3 gap-3">
          <div>
            <dt className={textStyle({ tone: 'muted', variant: 'meta' })}>Traces</dt>
            <dd className={textStyle({ tone: 'ink', variant: 'caption' })}>{metadata.traceCount}</dd>
          </div>
          <div>
            <dt className={textStyle({ tone: 'muted', variant: 'meta' })}>Signals set</dt>
            <dd className={textStyle({ tone: 'ink', variant: 'caption' })}>{metadata.signalsSet}</dd>
          </div>
          <div>
            <dt className={textStyle({ tone: 'muted', variant: 'meta' })}>Updated</dt>
            <dd title={entity.updatedAt} className={textStyle({ tone: 'ink', variant: 'caption' })}>
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
