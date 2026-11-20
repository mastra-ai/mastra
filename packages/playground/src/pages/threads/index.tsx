import {
  useFeedbackAvailable,
  useThreadQueryAvailable,
  useTraceQueryAvailable,
} from '@mastra/playground-ui/domains/capabilities';
import {
  ObservabilityCapabilityGate,
  readThreadSelection,
  withThreadSelection,
} from '@mastra/playground-ui/domains/observability';
import { ThreadsExplorerBody } from '@mastra/playground-ui/domains/threads/components/threads-explorer-body';
import { useThreadsExplorer } from '@mastra/playground-ui/domains/threads/hooks/use-threads-explorer';
import { TraceThreadPanel } from '@mastra/playground-ui/domains/traces/components/trace-thread-panel';
import { useNavigate, useSearchParams } from 'react-router';
import { traceScoreLink } from '@/lib/app-routing';

function ThreadsExplorer() {
  const navigate = useNavigate();
  // The open thread, time range, filters and sort live in the URL, so they survive a reload and can be shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const explorer = useThreadsExplorer({ searchParams, setSearchParams });
  const withQueryTrace = useTraceQueryAvailable().enabled;
  const withFeedback = useFeedbackAvailable().enabled;

  return (
    <ThreadsExplorerBody
      {...explorer}
      selectedThreadId={readThreadSelection(searchParams)}
      onSelectedThreadChange={threadId =>
        setSearchParams(current => withThreadSelection(current, threadId), { replace: true })
      }
      renderPanel={({ threadId, onClose }) => (
        <TraceThreadPanel
          open={!!threadId}
          threadId={threadId ?? ''}
          depth={1}
          closeLabel="Close"
          withQueryTrace={withQueryTrace}
          withFeedback={withFeedback}
          onOpenScore={(traceId, scoreId) => navigate(traceScoreLink(traceId, scoreId))}
          onClose={onClose}
        />
      )}
    />
  );
}

export default function ThreadsPage() {
  const { enabled, isLoading } = useThreadQueryAvailable();

  return (
    <ObservabilityCapabilityGate
      enabled={enabled}
      isLoading={isLoading}
      heading="Threads"
      title="Query threads capability not activated"
      description="Your observability storage does not support thread row queries. Switch to a store that declares the thread-query-rows capability to list threads."
    >
      <ThreadsExplorer />
    </ObservabilityCapabilityGate>
  );
}
