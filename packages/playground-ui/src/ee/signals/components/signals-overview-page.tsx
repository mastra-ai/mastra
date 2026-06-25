import { ArrowUpRight } from 'lucide-react';
import { Badge } from '../../../ds/components/Badge';
import { Button } from '../../../ds/components/Button';
import { EmptyState } from '../../../ds/components/EmptyState';
import { ErrorState } from '../../../ds/components/ErrorState';
import { Skeleton } from '../../../ds/components/Skeleton/skeleton';
import { stringToColor } from '../../../lib/colors';
import { TopicsLayout } from '../../topics';
import { useEntities } from '../hooks/use-entity-learning';
import { useSignalTopics } from '../hooks/use-signal-topics';
import type { EntityLearningTopic } from '../types';

interface SignalClusterCardProps {
  topic: EntityLearningTopic;
}

export function SignalClusterCard({ topic }: SignalClusterCardProps) {
  const traceShare = Math.round(topic.coverage * 100);
  const itemLabel = topic.itemCount === 1 ? 'trace' : 'traces';
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
            <p className="font-mono text-xs uppercase text-neutral3">Trace share</p>
            <p className="font-mono text-xs text-neutral3">
              {topic.itemCount} {itemLabel}
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-4">
            <div
              className="h-3 overflow-hidden rounded-full bg-surface4"
              role="progressbar"
              aria-label={`${topic.name} trace share`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={traceShare}
            >
              <div className="h-full rounded-full" style={{ width: `${traceShare}%`, backgroundColor: clusterColor }} />
            </div>
            <p className="text-right text-ui-md font-semibold text-neutral6">{traceShare}%</p>
          </div>
        </div>
      </div>
    </article>
  );
}

interface SignalSectionProps {
  entityId: string;
  signalName: string;
  runId: string;
  onSeeDetails: (signalName: string) => void;
}

export function SignalSection({ entityId, signalName, runId, onSeeDetails }: SignalSectionProps) {
  const { data, isPending, error } = useSignalTopics(entityId, signalName, runId);
  const topics = data?.topics ?? [];

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-6 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-ui-2xl font-semibold text-neutral6 capitalize">{signalName}</h2>
            {!isPending && !error && (
              <Badge variant="default">
                {topics.length} {topics.length === 1 ? 'cluster' : 'clusters'}
              </Badge>
            )}
          </div>
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

      {isPending ? (
        <div className="grid gap-6 md:grid-cols-2" aria-label={`Loading ${signalName} clusters`}>
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : error ? (
        <ErrorState title="Couldn't load clusters" message={`Failed to load clusters for ${signalName}.`} />
      ) : topics.length === 0 ? (
        <EmptyState
          iconSlot={null}
          titleSlot="No clusters yet"
          descriptionSlot={`No clusters were found for ${signalName}.`}
        />
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
  onSignalSelect: (signalName: string) => void;
}

export function SignalsOverviewPage({ onSignalSelect }: SignalsOverviewPageProps) {
  const { data: entities, isPending, error } = useEntities();

  const sections = (entities ?? []).flatMap(entity =>
    entity.availableSignals.map(signalName => ({
      key: `${entity.entityId}:${signalName}`,
      entityId: entity.entityId,
      signalName,
      runId: entity.latestRunId,
    })),
  );

  return (
    <TopicsLayout sidebar={null} contentPadding={false}>
      <nav className="h-full min-w-0 overflow-y-auto p-6" aria-label="Signals">
        <div className="mx-auto flex max-w-6xl flex-col gap-12">
          {isPending ? (
            <div className="flex flex-col gap-6" aria-label="Loading signals">
              <Skeleton className="h-10 w-48" />
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
              </div>
            </div>
          ) : error ? (
            <ErrorState title="Couldn't load signals" message="Failed to load entity learning signals." />
          ) : sections.length === 0 ? (
            <EmptyState
              iconSlot={null}
              titleSlot="No signals yet"
              descriptionSlot="No entity learning signals are available."
            />
          ) : (
            sections.map(section => (
              <SignalSection
                key={section.key}
                entityId={section.entityId}
                signalName={section.signalName}
                runId={section.runId}
                onSeeDetails={onSignalSelect}
              />
            ))
          )}
        </div>
      </nav>
    </TopicsLayout>
  );
}
