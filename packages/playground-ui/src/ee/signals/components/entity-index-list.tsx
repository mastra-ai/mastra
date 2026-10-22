import type { ThemeLearningEntity } from '@mastra/client-js';

import { DataList } from '../../../ds/components/DataList';
import type { LinkComponent } from '../../../ds/types/link-component';
import { entityIndexMetadata } from './entity-index-model';
import { EntityIndexStatus } from './entity-index-status';

const columns = 'minmax(12rem,1.5fr) minmax(7rem,0.6fr) minmax(8rem,0.7fr) minmax(8rem,0.7fr) minmax(12rem,1fr)';

export interface EntityIndexListProps {
  entities: readonly ThemeLearningEntity[];
  hasSearch: boolean;
  getEntityHref: (entity: ThemeLearningEntity) => string;
  LinkComponent: LinkComponent;
}

export function EntityIndexList({ entities, hasSearch, getEntityHref, LinkComponent }: EntityIndexListProps) {
  return (
    <section aria-label="Trace Intelligence agents" className="min-h-0">
      <DataList columns={columns} fit="container">
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
          const key = `${entity.entityType}:${entity.entityId}`;
          const isAnalyzing = entity.status === 'collecting';
          const cells = (
            <>
              <DataList.Cell className="min-w-0 overflow-visible text-left">
                {isAnalyzing ? null : <span className="sr-only">Open agent {entity.entityId}</span>}
                <span
                  aria-hidden={isAnalyzing ? undefined : true}
                  className="block overflow-clip text-ellipsis whitespace-nowrap"
                >
                  {entity.entityId}
                </span>
              </DataList.Cell>
              <DataList.NumberCell>{metadata.traceCount}</DataList.NumberCell>
              <DataList.Cell>{metadata.signalsSet}</DataList.Cell>
              <DataList.Cell className="overflow-visible">
                <EntityIndexStatus entity={entity} />
              </DataList.Cell>
              <DataList.Cell title={entity.updatedAt}>{metadata.updatedAt}</DataList.Cell>
            </>
          );
          // No signals yet means the detail page has nothing to show, so the row stays static.
          if (isAnalyzing) {
            return (
              <DataList.RowStatic key={key} className="min-w-0">
                {cells}
              </DataList.RowStatic>
            );
          }
          return (
            <DataList.RowLink key={key} to={getEntityHref(entity)} LinkComponent={LinkComponent} className="min-w-0">
              {cells}
            </DataList.RowLink>
          );
        })}
      </DataList>
    </section>
  );
}
