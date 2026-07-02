import type { CSSProperties } from 'react';
import { ArrowUpRight, CircleSlashIcon, InboxIcon, MousePointerClickIcon } from 'lucide-react';
import { Badge } from '../../../ds/components/Badge';
import { Button } from '../../../ds/components/Button';
import { EmptyState } from '../../../ds/components/EmptyState';
import { Skeleton } from '../../../ds/components/Skeleton';
import { Spinner } from '../../../ds/components/Spinner';
import { stringToColor } from '../../../lib/colors';
import { TopicsLayout } from '../../topics';
import { useEntities, useEntityTopics } from '../hooks';
import type { EntityLearningEntitySummary, EntityLearningTopic } from '../services';
import { getSignalCatalogEntry } from '../signals-data';
import type { SelectedEntity, SignalCatalogEntry } from '../types';
import { SignalsEntityFilter } from './signals-entity-filter';

interface SignalClusterCardProps {
  topic: EntityLearningTopic;
  onSelect: (topicId: string) => void;
}

export function SignalClusterCard({ topic, onSelect }: SignalClusterCardProps) {
  const coveragePct = Math.round(topic.coverage * 100);
  const itemLabel = topic.itemCount === 1 ? 'item' : 'items';
  const clusterColor = stringToColor(topic.name);
  const clusterStyle = { '--cluster-color': clusterColor } as CSSProperties;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(topic.topicId)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(topic.topicId);
        }
      }}
      className="group cursor-pointer rounded-2xl border border-border1/70 bg-surface2 p-5 shadow-sm transition-colors hover:border-[var(--cluster-color)] focus-visible:border-[var(--cluster-color)] focus-visible:outline-none"
      style={clusterStyle}
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: clusterColor }} />

          <div>
            <h3 className="text-md font-semibold text-neutral6">{topic.name}</h3>
            <p className="line-clamp-2 text-sm text-neutral3">{topic.description}</p>
          </div>
        </div>

        <div className="space-y-1 pt-4 pl-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase text-neutral3">Coverage</p>
            <p className="font-mono text-xs text-neutral3">
              {topic.itemCount} {itemLabel}
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-4">
            <div
              className="h-3 overflow-hidden rounded-full bg-surface4"
              role="progressbar"
              aria-label={`${topic.name} coverage`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={coveragePct}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${coveragePct}%`, backgroundColor: clusterColor }}
              />
            </div>
            <p className="text-right text-ui-md font-semibold text-neutral6">{coveragePct}%</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function SignalClusterCardSkeleton() {
  return (
    <article className="rounded-2xl border border-border1/70 bg-surface2 p-5 shadow-sm" aria-hidden="true">
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex min-w-0 items-start gap-2">
          <Skeleton className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>

        <div className="space-y-2 pt-4 pl-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      </div>
    </article>
  );
}

function SignalSectionSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2" aria-label="Loading clusters" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <SignalClusterCardSkeleton key={index} />
      ))}
    </div>
  );
}

interface SignalSectionProps {
  entity: EntityLearningEntitySummary;
  catalog: SignalCatalogEntry;
  signalName: string;
  onSeeDetails: (signalName: string) => void;
  onSelectCluster: (signalName: string, topicId: string) => void;
}

export function SignalSection({ entity, catalog, signalName, onSeeDetails, onSelectCluster }: SignalSectionProps) {
  const { data, isLoading, isError } = useEntityTopics(entity.entityId, signalName, entity.latestRunId);
  const topics = data?.topics ?? [];

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-6 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-ui-2xl font-semibold text-neutral6">{catalog.name}</h2>
            {isLoading ? (
              <Skeleton className="h-badge-default w-20 rounded-full" aria-hidden="true" />
            ) : !isError ? (
              <Badge variant="default">
                {topics.length} {topics.length === 1 ? 'cluster' : 'clusters'}
              </Badge>
            ) : null}
          </div>
          {catalog.description ? <p className="text-ui-lg text-neutral3">{catalog.description}</p> : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="shrink-0 gap-2 rounded-xl px-5"
          onClick={() => onSeeDetails(signalName)}
        >
          See details
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      {isLoading ? (
        <SignalSectionSkeleton />
      ) : isError ? (
        <p className="px-1 text-ui-md text-accent2">Failed to load clusters for this signal.</p>
      ) : topics.length === 0 ? (
        <p className="px-1 text-ui-md text-neutral3">No clusters found for this signal yet.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {topics.map(topic => (
            <SignalClusterCard
              key={topic.topicId}
              topic={topic}
              onSelect={topicId => onSelectCluster(signalName, topicId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export interface SignalsOverviewPageProps {
  selectedEntity: SelectedEntity | null;
  onEntityChange: (selected: SelectedEntity | null) => void;
  onSignalSelect: (signalName: string, topicId?: string) => void;
}

export function SignalsOverviewPage({ selectedEntity, onEntityChange, onSignalSelect }: SignalsOverviewPageProps) {
  const { data: entities = [], isLoading, isError } = useEntities();

  const entity = selectedEntity ? entities.find(item => item.entityId === selectedEntity.entityId) : undefined;

  // Only show the pinned filter bar once an agent is selected. While entities
  // are loading/erroring/empty, or when none is selected, the picker is surfaced
  // through the centered empty state instead, so the skeleton/loading view never
  // shows the top bar with an empty agent dropdown.
  const showFilterBar = Boolean(entity);

  return (
    <TopicsLayout sidebar={null} contentPadding={false}>
      <div className="flex h-full min-w-0 flex-col" aria-label="Signals">
        {showFilterBar && (
          <div className="border-b border-border1/70 px-6 py-4">
            <SignalsEntityFilter entities={entities} selected={selectedEntity} onChange={onEntityChange} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState iconSlot={<Spinner />} titleSlot="Loading entities…" />
            </div>
          ) : isError ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                iconSlot={<CircleSlashIcon />}
                titleSlot="Failed to load entities"
                descriptionSlot="Failed to load entities from the observability endpoint."
              />
            </div>
          ) : entities.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                iconSlot={<InboxIcon />}
                titleSlot="No entities available"
                descriptionSlot="No entities are available on the server yet."
              />
            </div>
          ) : !entity ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                iconSlot={<MousePointerClickIcon />}
                titleSlot="No entity selected"
                descriptionSlot="Select an entity to inspect its signals and clusters."
                actionSlot={
                  <SignalsEntityFilter entities={entities} selected={selectedEntity} onChange={onEntityChange} />
                }
              />
            </div>
          ) : entity.availableSignals.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                iconSlot={<InboxIcon />}
                titleSlot="No signals yet"
                descriptionSlot="This entity has no signals yet."
              />
            </div>
          ) : (
            <div className="mx-auto flex max-w-6xl flex-col gap-12">
              {entity.availableSignals.map(signalName => (
                <SignalSection
                  key={signalName}
                  entity={entity}
                  signalName={signalName}
                  catalog={getSignalCatalogEntry(signalName)}
                  onSeeDetails={onSignalSelect}
                  onSelectCluster={onSignalSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </TopicsLayout>
  );
}
