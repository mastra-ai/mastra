import {
  SignalDetailsPage as SignalDetailsPageContent,
  SignalTraceDetailsPanel,
} from '@mastra/playground-ui/ee/signals/components/signal-details-page';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

function useSelectedEntity() {
  const [searchParams] = useSearchParams();
  const entityId = searchParams.get('entityId');
  const entity = entityId ? { entityType: 'agent', entityId } : null;

  return { entity };
}

function SignalDetailsScrollBoundary({ children }: { children: ReactNode }) {
  return (
    <div data-testid="signal-details-scroll-boundary" className="h-full min-h-0 min-w-0 overflow-y-auto">
      {children}
    </div>
  );
}

function SignalDetailsRouteContent({ selectedTraceId }: { selectedTraceId: string | null }) {
  const navigate = useNavigate();
  const { signalId } = useParams();
  const [searchParams] = useSearchParams();
  const { entity } = useSelectedEntity();
  const initialTopicId = searchParams.get('topicId');
  // Preserve the full current query (entityId + topicId) so opening a trace keeps
  // the selected cluster instead of remounting the details page on the first topic.
  const routeQuery = searchParams.toString();

  const handleTraceSelect = (nextSignalId: string, traceId: string) => {
    void navigate(`/signals/${nextSignalId}/traces/${traceId}${routeQuery ? `?${routeQuery}` : ''}`);
  };

  return (
    <SignalDetailsScrollBoundary>
      <SignalDetailsPageContent
        signalId={signalId}
        entity={entity}
        selectedTraceId={selectedTraceId}
        initialTopicId={initialTopicId}
        onTraceSelect={handleTraceSelect}
      />
    </SignalDetailsScrollBoundary>
  );
}

export function SignalDetailsPage() {
  return <SignalDetailsRouteContent selectedTraceId={null} />;
}

export function SignalTraceIdPage() {
  const navigate = useNavigate();
  const { signalId, traceId } = useParams();
  const [searchParams] = useSearchParams();
  const { entity } = useSelectedEntity();
  const initialTopicId = searchParams.get('topicId');
  const routeQuery = searchParams.toString();
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  const handleTraceClose = () => {
    setSelectedSpanId(null);
    void navigate(signalId ? `/signals/${signalId}${routeQuery ? `?${routeQuery}` : ''}` : '/signals');
  };

  const handleTraceSelect = (nextSignalId: string, nextTraceId: string) => {
    void navigate(`/signals/${nextSignalId}/traces/${nextTraceId}${routeQuery ? `?${routeQuery}` : ''}`);
  };

  return (
    <SignalDetailsScrollBoundary>
      <SignalDetailsPageContent
        signalId={signalId}
        entity={entity}
        selectedTraceId={traceId ?? null}
        initialTopicId={initialTopicId}
        onTraceSelect={handleTraceSelect}
        tracePanel={
          traceId ? (
            <SignalTraceDetailsPanel
              traceId={traceId}
              selectedSpanId={selectedSpanId}
              onSpanSelect={spanId => setSelectedSpanId(spanId ?? null)}
              onClose={handleTraceClose}
            />
          ) : null
        }
      />
    </SignalDetailsScrollBoundary>
  );
}

export default SignalDetailsPage;
