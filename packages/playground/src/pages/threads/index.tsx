import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useThreadQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import { TracesSpansSwitchSkeleton } from '@mastra/playground-ui/domains/traces/components/traces-spans-switch';
import { threadsCrumbs, tracesCrumbs } from './crumbs';
import { ThreadsPageContent } from './threads-page-content';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

export default function ThreadsPage() {
  const { enabled, isLoading } = useThreadQueryAvailable();

  // The content owns its layout so it can put the filter bar in the page body.
  if (enabled) return <ThreadsPageContent />;

  // While loading, hold the switch's place under the header so it does not push the page down when it lands.
  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={isLoading ? tracesCrumbs : threadsCrumbs} />}
      actionRow={isLoading ? <TracesSpansSwitchSkeleton /> : undefined}
    >
      <h1 className="sr-only">Threads</h1>
      {isLoading ? (
        <div className="flex h-full items-center justify-center gap-2">
          <Spinner aria-label="Loading storage capabilities" />
          <Txt as="span" variant="caption" tone="muted">
            Loading storage capabilities
          </Txt>
        </div>
      ) : (
        <EmptyState
          variant="fill"
          titleSlot="Query threads capability not activated"
          descriptionSlot="Your observability storage does not support thread row queries. Switch to a store that declares the thread-query-rows capability to list threads."
        />
      )}
    </PageLayout>
  );
}
