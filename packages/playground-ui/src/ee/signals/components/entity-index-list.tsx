import type { ThemeLearningEntity } from '@mastra/client-js';

import { entityIndexMetadata, entityStatusPresentation } from './entity-index-model';
import { DataList } from '@/ds/components/DataList';
import { Status } from '@/ds/components/StatusIndicators';
import type { LinkComponent } from '@/ds/types/link-component';

const columns = 'minmax(12rem,1.5fr) minmax(7rem,0.6fr) minmax(8rem,0.7fr) minmax(8rem,0.7fr) minmax(12rem,1fr)';

export interface EntityIndexListProps {
  entities: readonly ThemeLearningEntity[];
  hasSearch: boolean;
  getEntityHref: (entity: ThemeLearningEntity) => string;
  LinkComponent: LinkComponent;
}

export function EntityIndexList({ entities, hasSearch, getEntityHref, LinkComponent }: EntityIndexListProps) {
  return (
    <section aria-label="Trace Intelligence entities" className="min-h-0">
      <DataList columns={columns} fit="container">
        <DataList.Top>
          <DataList.TopCell>Entity</DataList.TopCell>
          <DataList.TopCell>Traces</DataList.TopCell>
          <DataList.TopCell>Signals set</DataList.TopCell>
          <DataList.TopCell>Status</DataList.TopCell>
          <DataList.TopCell>Updated</DataList.TopCell>
        </DataList.Top>
        {entities.length === 0 && hasSearch ? <DataList.NoMatch message="No entities match your search" /> : null}
        {entities.map(entity => {
          const metadata = entityIndexMetadata(entity);
          return (
            <DataList.RowLink
              key={`${entity.entityType}:${entity.entityId}`}
              to={getEntityHref(entity)}
              LinkComponent={LinkComponent}
              className="min-w-0"
            >
              <DataList.Cell className="min-w-0 overflow-visible text-left">
                <span className="sr-only">Open entity {entity.entityId}</span>
                <span aria-hidden="true" className="block overflow-clip text-ellipsis whitespace-nowrap">
                  {entity.entityId}
                </span>
              </DataList.Cell>
              <DataList.NumberCell>{metadata.traceCount}</DataList.NumberCell>
              <DataList.Cell>{metadata.signalsSet}</DataList.Cell>
              <DataList.Cell>
                <Status presentation={entityStatusPresentation(entity.status)} />
              </DataList.Cell>
              <DataList.Cell title={entity.updatedAt}>{metadata.updatedAt}</DataList.Cell>
            </DataList.RowLink>
          );
        })}
      </DataList>
    </section>
  );
}
