import type { ThemeLearningEntity } from '@mastra/client-js';

import { entityIndexColumns, entityIndexMetadata } from './entity-index-model';
import { EntityIndexStatus } from './entity-index-status';
import { DataList } from '@/ds/components/DataList';
import type { LinkComponent } from '@/ds/types/link-component';

export interface EntityIndexListProps {
  entities: readonly ThemeLearningEntity[];
  hasSearch: boolean;
  getEntityHref: (entity: ThemeLearningEntity) => string;
  LinkComponent: LinkComponent;
}

export function EntityIndexList({ entities, hasSearch, getEntityHref, LinkComponent }: EntityIndexListProps) {
  return (
    <section aria-label="Trace Intelligence agents" className="min-h-0">
      <DataList columns={entityIndexColumns} fit="container">
        <DataList.Top>
          <DataList.TopCell>Agent</DataList.TopCell>
          <DataList.TopCell>Traces</DataList.TopCell>
          <DataList.TopCell>Signals set</DataList.TopCell>
          <DataList.TopCell>Status</DataList.TopCell>
          <DataList.TopCell>Updated</DataList.TopCell>
        </DataList.Top>
        {entities.length === 0 && hasSearch ? <DataList.NoMatch message="No agents match your search" /> : null}
        {entities.map(entity => {
          const metadata = entityIndexMetadata(entity);
          const cells = (
            <>
              <DataList.NameCell>
                <span title={entity.entityId}>{entity.entityId}</span>
              </DataList.NameCell>
              <DataList.NumberCell>{metadata.traceCount}</DataList.NumberCell>
              <DataList.Cell>{metadata.signalsSet}</DataList.Cell>
              <DataList.Cell className="overflow-visible">
                <EntityIndexStatus entity={entity} />
              </DataList.Cell>
              <DataList.Cell title={entity.updatedAt}>{metadata.updatedAt}</DataList.Cell>
            </>
          );
          const key = `${entity.entityType}:${entity.entityId}`;
          if (entity.status === 'collecting') {
            return (
              <DataList.RowStatic key={key} className="min-w-0">
                {cells}
              </DataList.RowStatic>
            );
          }
          return (
            <DataList.RowLink
              key={key}
              to={getEntityHref(entity)}
              LinkComponent={LinkComponent}
              className="min-w-0"
              aria-label={`Open agent ${entity.entityId}`}
            >
              {cells}
            </DataList.RowLink>
          );
        })}
      </DataList>
    </section>
  );
}
