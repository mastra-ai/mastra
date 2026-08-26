import { Notice } from '@mastra/playground-ui/components/Notice';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useTraces } from '@mastra/playground-ui/domains/traces/hooks/use-traces';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { TracesInvestigation } from '@/domains/traces/components/traces-investigation';

/** Owns the thread's trace query plus its loading/error states. Split out so the
 *  page can bail out on a missing `threadId` before any hook runs. */
function TracesInvestigationInner({ threadId }: { threadId: string }) {
  // `useTraces` keys effects on the `filters` identity, so an inline object would
  // reset its state on every render and loop forever.
  const filters = useMemo(() => ({ threadId }), [threadId]);
  const { data, isLoading, isError, error } = useTraces({ filters });

  // The list endpoints order by `startedAt DESC`; the investigation reads
  // top-to-bottom in chronological order, so flip it here.
  const traces = useMemo(() => [...(data?.spans ?? [])].reverse(), [data?.spans]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="traces-investigation-loading">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <Notice variant="destructive">
        <Notice.Message>{error?.message ?? 'Failed to load traces for this thread.'}</Notice.Message>
      </Notice>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <TracesInvestigation threadId={threadId} traces={traces} />
    </div>
  );
}

export default function TracesInvestigatePage() {
  const [searchParams] = useSearchParams();
  const threadId = searchParams.get('threadId');

  return (
    <PageLayout>
      <PageLayout.MainArea>
        {threadId ? (
          <TracesInvestigationInner threadId={threadId} />
        ) : (
          <Notice variant="warning">
            <Notice.Message>404 — Thread not found. This page requires a `threadId` query parameter.</Notice.Message>
          </Notice>
        )}
      </PageLayout.MainArea>
    </PageLayout>
  );
}
