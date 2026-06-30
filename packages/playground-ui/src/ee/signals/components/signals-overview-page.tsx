import { ArrowUpRight } from 'lucide-react';
import { Badge } from '../../../ds/components/Badge';
import { Button } from '../../../ds/components/Button';
import { stringToColor } from '../../../lib/colors';
import { TopicsLayout } from '../../topics';
import { useEntities, useEntityTopics } from '../hooks';
import type { EntityLearningEntitySummary, EntityLearningTopic } from '../services';
import { getSignalCatalogEntry } from '../signals-data';
import type { SelectedEntity, SignalCatalogEntry } from '../types';
import { SignalsEntityFilter } from './signals-entity-filter';

interface SignalClusterCardProps {
  topic: EntityLearningTopic;
}

export function SignalClusterCard({ topic }: SignalClusterCardProps) {
  const coveragePct = Math.round(topic.coverage * 100);
  const itemLabel = topic.itemCount === 1 ? 'item' : 'items';
  const clusterColor = stringToColor(topic.name);

  return (
    <article className="rounded-2xl border border-border1/70 bg-surface2 p-5 shadow-sm">
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

interface SignalSectionProps {
  entity: EntityLearningEntitySummary;
  catalog: SignalCatalogEntry;
  signalName: string;
  onSeeDetails: (signalName: string) => void;
}

export function SignalSection({ entity, catalog, signalName, onSeeDetails }: SignalSectionProps) {
  const { data, isLoading, isError } = useEntityTopics(entity.entityId, signalName, entity.latestRunId);
  const topics = data?.topics ?? [];

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-6 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-ui-2xl font-semibold text-neutral6">{catalog.name}</h2>
            {!isLoading && !isError ? (
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
        <p className="px-1 text-ui-md text-neutral3">Loading clusters…</p>
      ) : isError ? (
        <p className="px-1 text-ui-md text-accent2">Failed to load clusters for this signal.</p>
      ) : topics.length === 0 ? (
        <p className="px-1 text-ui-md text-neutral3">No clusters found for this signal yet.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {topics.map(topic => (
            <SignalClusterCard key={topic.topicId} topic={topic} />
          ))}
        </div>
      )}
    </section>
  );
}

export interface SignalsOverviewPageProps {
  selectedEntity: SelectedEntity | null;
  onEntityChange: (selected: SelectedEntity | null) => void;
  onSignalSelect: (signalName: string) => void;
}

export function SignalsOverviewPage({ selectedEntity, onEntityChange, onSignalSelect }: SignalsOverviewPageProps) {
  const { data: entities = [], isLoading, isError } = useEntities();

  const entity = selectedEntity ? entities.find(item => item.entityId === selectedEntity.entityId) : undefined;

  return (
    <TopicsLayout sidebar={null} contentPadding={false}>
      <nav className="h-full min-w-0 overflow-y-auto p-6" aria-label="Signals">
        <div className="mx-auto flex max-w-6xl flex-col gap-12">
          <SignalsEntityFilter entities={entities} selected={selectedEntity} onChange={onEntityChange} />

          {isLoading ? (
            <p className="text-ui-md text-neutral3">Loading entities…</p>
          ) : isError ? (
            <p className="text-ui-md text-accent2">Failed to load entities from the observability endpoint.</p>
          ) : entities.length === 0 ? (
            <p className="text-ui-md text-neutral3">No entities are available on the server yet.</p>
          ) : !entity ? (
            <p className="text-ui-md text-neutral3">Select an entity to inspect its signals and clusters.</p>
          ) : entity.availableSignals.length === 0 ? (
            <p className="text-ui-md text-neutral3">This entity has no signals yet.</p>
          ) : (
            entity.availableSignals.map(signalName => (
              <SignalSection
                key={signalName}
                entity={entity}
                signalName={signalName}
                catalog={getSignalCatalogEntry(signalName)}
                onSeeDetails={onSignalSelect}
              />
            ))
          )}
        </div>
      </nav>
    </TopicsLayout>
  );
}
