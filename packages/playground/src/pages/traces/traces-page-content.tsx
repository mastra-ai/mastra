import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { useSpanQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { memo } from 'react';
import { useNavigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import { navCrumb } from '@/domains/navigation/crumbs';
import { TracesSpansSwitch } from '@/domains/traces/components/traces-spans-switch';
import { LiveKitRecordingReview } from '@/domains/voice/components/livekit-recording-review';
import { traceScoreLink } from '@/lib/app-routing';

const crumbs = [navCrumb('/traces')];

// Memoized so a URL change (trace click, filter edit) re-renders only the explorer parts whose
// context slice changed, not the whole tree.
export const TracesPageContent = memo(function TracesPageContent({ isScoped }: { isScoped: boolean }) {
  const navigate = useNavigate();
  const { enabled: spanQueryEnabled, isLoading: spanQueryLoading } = useSpanQueryAvailable();

  // Scoped instances render inside another page (e.g. the agent Traces tab) that already owns the header.
  // Stores that can query spans swap the header for the Traces/Spans switch; while capabilities load,
  // neither renders so the header doesn't flash before the switch replaces it.
  const showSwitch = !isScoped && spanQueryEnabled;
  const showBreadcrumbs = !isScoped && !spanQueryLoading && !spanQueryEnabled;

  return (
    <TracesExplorer.Layout
      breadcrumbs={showBreadcrumbs ? <PageBreadcrumbs crumbs={crumbs} /> : undefined}
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            {showSwitch && <TracesSpansSwitch current="traces" />}
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
