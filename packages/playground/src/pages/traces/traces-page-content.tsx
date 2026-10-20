import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { memo } from 'react';
import { useNavigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import { navCrumb } from '@/domains/navigation/crumbs';
import { LiveKitRecordingReview } from '@/domains/voice/components/livekit-recording-review';
import { traceScoreLink } from '@/lib/app-routing';

const crumbs = [navCrumb('/traces')];

// Memoized so a URL change (trace click, filter edit) re-renders only the explorer parts whose
// context slice changed, not the whole tree.
export const TracesPageContent = memo(function TracesPageContent({ isScoped }: { isScoped: boolean }) {
  const navigate = useNavigate();

  return (
    <TracesExplorer.Layout
      // Scoped instances render inside another page (e.g. the agent Traces tab) that already owns the header.
      breadcrumbs={isScoped ? undefined : <PageBreadcrumbs crumbs={crumbs} />}
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <TracesExplorer.FilterBar />
          </ActionRow.Start>
          <ActionRow.End>
            <TracesExplorer.ColumnsMenu />
            <TracesExplorer.AutoRefresh />
          </ActionRow.End>
        </ActionRow>
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
