import { useThreadQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import {
  ObservabilityCapabilityGate,
  readThreadSelection,
  withThreadSelection,
} from '@mastra/playground-ui/domains/observability';
import { ThreadsExplorerBody } from '@mastra/playground-ui/domains/threads/components/threads-explorer-body';
import { useNavigate, useSearchParams } from 'react-router';
import { traceScoreLink } from '@/lib/app-routing';

export default function ThreadsPage() {
  const { enabled, isLoading } = useThreadQueryAvailable();
  const navigate = useNavigate();
  // The open thread, time range, filters and sort live in the URL, so they survive a reload and can be shared.
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <ObservabilityCapabilityGate
      enabled={enabled}
      isLoading={isLoading}
      heading="Threads"
      title="Query threads capability not activated"
      description="Your observability storage does not support thread row queries. Switch to a store that declares the thread-query-rows capability to list threads."
    >
      <ThreadsExplorerBody
        urlState={{ searchParams, setSearchParams }}
        selectedThreadId={readThreadSelection(searchParams)}
        onSelectedThreadChange={threadId =>
          setSearchParams(current => withThreadSelection(current, threadId), { replace: true })
        }
        onOpenScore={(traceId, scoreId) => navigate(traceScoreLink(traceId, scoreId))}
      />
    </ObservabilityCapabilityGate>
  );
}
