import type { ThemeLearningEntity } from '@mastra/client-js';
import { Columns2, List, Radar } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useThemeEntities } from '../hooks';
import { TraceSignalSettingsButton, TraceSignalSettingsPanel } from '../settings/trace-signal-settings';
import { useTraceIntelligence } from '../use-trace-intelligence';
import { EntityIndexCompactGrid } from './entity-index-compact-grid';
import { EntityIndexList } from './entity-index-list';
import { filterAndSortEntities } from './entity-index-model';
import type { TraceIntelligenceEntitySort, TraceIntelligenceEntityView } from './entity-index-model';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DataListSkeleton } from '@/ds/components/DataList';
import { EmptyState } from '@/ds/components/EmptyState';
import { ErrorState } from '@/ds/components/ErrorState';
import { ListSearch } from '@/ds/components/ListSearch';
import { NoDataPageLayout, PageLayout } from '@/ds/components/PageLayout';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { SessionExpired } from '@/ds/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@/utils/errors';

export type { TraceIntelligenceEntitySort, TraceIntelligenceEntityView } from './entity-index-model';

const listColumns = 'minmax(12rem,1.5fr) minmax(7rem,0.6fr) minmax(8rem,0.7fr) minmax(8rem,0.7fr) minmax(12rem,1fr)';

export interface TraceIntelligenceEntityIndexProps {
  entityType: string;
  search: string;
  sort: TraceIntelligenceEntitySort;
  view: TraceIntelligenceEntityView;
  onSearchChange: (search: string) => void;
  onSortChange: (sort: TraceIntelligenceEntitySort) => void;
  onViewChange: (view: TraceIntelligenceEntityView) => void;
  getEntityHref: (entity: ThemeLearningEntity) => string;
  headerAction?: ReactNode;
}

function EntityIndexError({ error }: { error: Error }) {
  if (is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }
  if (is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="Trace Intelligence" />
      </NoDataPageLayout>
    );
  }
  return (
    <NoDataPageLayout>
      <ErrorState title="Failed to load Trace Intelligence" message={error.message} />
    </NoDataPageLayout>
  );
}

function EntityIndexControls({
  search,
  sort,
  view,
  onSearchChange,
  onSortChange,
  onViewChange,
  headerAction,
}: Pick<
  TraceIntelligenceEntityIndexProps,
  'search' | 'sort' | 'view' | 'onSearchChange' | 'onSortChange' | 'onViewChange' | 'headerAction'
>) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="max-w-120 flex-1">
        <ListSearch
          value={search}
          onSearch={onSearchChange}
          label="Filter entities"
          placeholder="Filter by entity identifier"
        />
      </div>
      <div className="flex items-center justify-between gap-2 sm:ml-auto sm:justify-end">
        <Select<TraceIntelligenceEntitySort> value={sort} onValueChange={onSortChange}>
          <SelectTrigger aria-label="Sort entities" size="md" variant="ghost" className="w-auto min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="default">Default order</SelectItem>
            <SelectItem value="entity-asc">Entity: A–Z</SelectItem>
            <SelectItem value="entity-desc">Entity: Z–A</SelectItem>
          </SelectContent>
        </Select>
        {headerAction}
        <ButtonsGroup spacing="close" aria-label="Entities view">
          <Button
            type="button"
            variant={view === 'list' ? 'default' : 'ghost'}
            size="icon-md"
            tooltip="List view"
            aria-pressed={view === 'list'}
            onClick={() => onViewChange('list')}
          >
            <List />
          </Button>
          <Button
            type="button"
            variant={view === 'compact' ? 'default' : 'ghost'}
            size="icon-md"
            tooltip="Compact view"
            aria-pressed={view === 'compact'}
            onClick={() => onViewChange('compact')}
          >
            <Columns2 />
          </Button>
        </ButtonsGroup>
      </div>
    </div>
  );
}

export function TraceIntelligenceEntityIndex({
  entityType,
  search,
  sort,
  view,
  onSearchChange,
  onSortChange,
  onViewChange,
  getEntityHref,
  headerAction,
}: TraceIntelligenceEntityIndexProps) {
  const entitiesQuery = useThemeEntities(entityType);
  const { LinkComponent, signalManagement } = useTraceIntelligence();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (entitiesQuery.error) return <EntityIndexError error={entitiesQuery.error} />;

  const entities = filterAndSortEntities(entitiesQuery.data?.entities ?? [], search, sort);
  const hasSearch = search.trim().length > 0;
  let body = (
    <EntityIndexList
      entities={entities}
      hasSearch={hasSearch}
      getEntityHref={getEntityHref}
      LinkComponent={LinkComponent}
    />
  );
  if (entitiesQuery.isPending) {
    body = (
      <div role="status" aria-label="Loading Trace Intelligence entities">
        <DataListSkeleton columns={listColumns} />
      </div>
    );
  } else if (entitiesQuery.data.entities.length === 0 && !hasSearch) {
    body = (
      <EmptyState
        iconSlot={<Radar aria-hidden="true" />}
        titleSlot="No Trace Intelligence entities yet"
        descriptionSlot="Entities appear after Trace Intelligence begins collecting generated signal data."
      />
    );
  } else if (view === 'compact') {
    body = (
      <EntityIndexCompactGrid
        entities={entities}
        hasSearch={hasSearch}
        getEntityHref={getEntityHref}
        LinkComponent={LinkComponent}
      />
    );
  }

  return (
    <PageLayout width="narrow" height="full" className="max-w-7xl grid-rows-[auto_minmax(0,1fr)] content-normal">
      <PageLayout.TopArea>
        <EntityIndexControls
          search={search}
          sort={sort}
          view={view}
          onSearchChange={onSearchChange}
          onSortChange={onSortChange}
          onViewChange={onViewChange}
          headerAction={
            headerAction || signalManagement ? (
              <>
                {headerAction}
                {signalManagement ? (
                  <TraceSignalSettingsButton open={settingsOpen} onClick={() => setSettingsOpen(open => !open)} />
                ) : null}
              </>
            ) : undefined
          }
        />
      </PageLayout.TopArea>
      <div
        className={
          settingsOpen
            ? 'grid max-h-full min-h-0 grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1fr]'
            : 'grid min-h-0 grid-cols-1'
        }
      >
        <div className="min-h-0 min-w-0">{body}</div>
        {settingsOpen ? <TraceSignalSettingsPanel onClose={() => setSettingsOpen(false)} /> : null}
      </div>
    </PageLayout>
  );
}
