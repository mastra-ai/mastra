import type { AgentControllerOMRecord } from '@mastra/client-js';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ObservationDetailView } from '@mastra/playground-ui/domains/memory/components';

interface ObservationalMemoryContentProps {
  record: AgentControllerOMRecord | undefined;
  isLoading: boolean;
}

/**
 * Buffered content has been produced but not yet folded into the committed
 * observation log, so it is labelled in words rather than only by placement.
 */
function PendingSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="border-border1 border-t px-4 py-3">
      <Txt as="h3" className="text-icon3 pb-1.5" variant="ui-sm">
        {title}
      </Txt>
      <p className="text-neutral6 whitespace-pre-wrap text-xs">{body}</p>
    </section>
  );
}

/**
 * The retained observational memory for the current session: the committed
 * observation log, plus any observations or reflection still pending.
 */
export function ObservationalMemoryContent({ record, isLoading }: ObservationalMemoryContentProps) {
  if (isLoading && !record) {
    return (
      <div className="space-y-2 px-4 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!record) {
    return (
      <p className="text-icon3 px-4 py-3 text-xs italic">
        Nothing has been read into memory for this conversation yet.
      </p>
    );
  }

  const pendingObservations = [
    record.bufferedObservations,
    ...(record.bufferedObservationChunks ?? []).map(c => c.observations),
  ]
    .filter((text): text is string => Boolean(text && text.trim()))
    .join('\n\n');
  const pendingReflection = record.bufferedReflection?.trim();

  return (
    <div className="flex min-h-0 flex-col">
      {/* A single record, so the view's history sidebar and diff affordance stay hidden. */}
      <div className="min-h-0 flex-1">
        <ObservationDetailView onSelectRecord={() => {}} records={[record]} selectedRecordId={record.id} />
      </div>
      {pendingObservations && <PendingSection body={pendingObservations} title="Pending activation" />}
      {pendingReflection && <PendingSection body={pendingReflection} title="Pending reflection" />}
    </div>
  );
}
