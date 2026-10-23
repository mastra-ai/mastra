import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { memo } from 'react';
import { useNavigate } from 'react-router';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import { LiveKitRecordingReview } from '@/domains/voice/components/livekit-recording-review';
import { traceScoreLink } from '@/lib/app-routing';

// Memoized so a URL change (trace click, filter edit) re-renders only the explorer parts whose
// context slice changed, not the whole tree.
export const TracesPageContent = memo(function TracesPageContent({ isScoped }: { isScoped: boolean }) {
  const navigate = useNavigate();

  const toolbar = (
    <ActionRow>
      <ActionRow.Start>
        <TracesExplorer.FilterBar />
      </ActionRow.Start>
      <ActionRow.End>
        <TracesExplorer.ColumnsMenu />
      </ActionRow.End>
    </ActionRow>
  );
  const content = (
    <>
      <TracesExplorer.List />
      <TracesExplorer.Panel
        headerActionsSlot={({ traceId, spans }) => (
          <LiveKitRecordingReview key={traceId} traceId={traceId} spans={spans} />
        )}
        onOpenScore={(traceId, scoreId) => navigate(traceScoreLink(traceId, scoreId))}
        renderCreateDatasetDialog={props => <CreateDatasetDialog {...props} />}
      />
    </>
  );

  // Scoped instances render inside another page (e.g. the agent Traces tab) whose header has no
  // breadcrumbs or view switch; /traces gets both from the shared observability layout.
  if (isScoped) return <TracesExplorer.Layout toolbar={toolbar}>{content}</TracesExplorer.Layout>;

  return <TracesExplorer.Body toolbar={toolbar}>{content}</TracesExplorer.Body>;
});
