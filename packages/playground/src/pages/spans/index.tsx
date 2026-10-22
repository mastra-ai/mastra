import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useSpanQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import { SpansPageContent } from './spans-page-content';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { TracesSpansSwitchSkeleton } from '@/domains/traces/components/traces-spans-switch';

// Spans has no sidebar entry of its own; it lives under Traces.
const crumbs = [navCrumb('/traces'), { id: 'spans', label: 'Spans' }];

export default function SpansPage() {
  const { enabled, isLoading } = useSpanQueryAvailable();

  // The content owns its layout so it can put the filter bar in the action row.
  if (enabled) return <SpansPageContent />;

  // While loading, hold the header row the way the switch will, so it does not swap a bordered breadcrumb out.
  return (
    <PageLayout
      breadcrumbs={isLoading ? <TracesSpansSwitchSkeleton /> : <PageBreadcrumbs crumbs={crumbs} />}
      headerBorder={!isLoading}
    >
      <h1 className="sr-only">Spans</h1>
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
          titleSlot="Query spans capability not activated"
          descriptionSlot="Your observability storage does not support span queries. Switch to a store that declares the span-query capability to list spans."
        />
      )}
    </PageLayout>
  );
}
