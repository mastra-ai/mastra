import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { memo } from 'react';
import { useNavigate } from 'react-router';
import { TracesActionRow } from './traces-action-row';
import { TracesSavedViewsToolbar } from './traces-saved-views-toolbar';
import type { TracesSavedViewsHost } from './traces-saved-views-toolbar';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import { navCrumb } from '@/domains/navigation/crumbs';
import { LiveKitRecordingReview } from '@/domains/voice/components/livekit-recording-review';
import { traceScoreLink } from '@/lib/app-routing';

const crumbs = [navCrumb('/traces')];

// Memoized so a URL change (trace click, filter edit) re-renders only the explorer parts whose
// context slice changed, not the whole tree. `savedViews` must keep its identity across those changes.
export const TracesPageContent = memo(function TracesPageContent({
  isScoped,
  savedViews,
}: {
  isScoped: boolean;
  /** Turns on saved views for this page. */
  savedViews?: TracesSavedViewsHost;
}) {
  const navigate = useNavigate();

  return (
    <TracesExplorer.Layout
      // Scoped instances render inside another page (e.g. the agent Traces tab) that already owns the header.
      breadcrumbs={isScoped ? undefined : <PageBreadcrumbs crumbs={crumbs} />}
      actionRow={
        savedViews ? (
          <TracesSavedViewsToolbar host={savedViews} />
        ) : (
          <TracesActionRow filterBar={<TracesExplorer.FilterBar />} />
        )
      }
    >
      <TracesExplorer.List />
      <TracesExplorer.Panel
        headerActionsSlot={({ traceId, spans }) => (
          <LiveKitRecordingReview key={traceId} traceId={traceId} spans={spans} />
        )}
        onOpenScore={(traceId, scoreId) => navigate(traceScoreLink(traceId, scoreId))}
        renderCreateDatasetDialog={props => <CreateDatasetDialog {...props} />}
      />
    </TracesExplorer.Layout>
  );
});
