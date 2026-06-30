import {
  SignalDetailsPage as SignalDetailsPageContent,
  SignalTraceDetailsPanel,
} from '@mastra/playground-ui/ee/signals/components/signal-details-page';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

function useSelectedEntity() {
  const [searchParams] = useSearchParams();
  const entityId = searchParams.get('entityId');
  const entity = entityId ? { entityType: 'agent', entityId } : null;
  const entityQuery = entityId ? `?entityId=${encodeURIComponent(entityId)}` : '';

  return { entity, entityQuery };
}

function SignalDetailsRouteContent({ selectedTraceId }: { selectedTraceId: string | null }) {
  const navigate = useNavigate();
  const { signalId } = useParams();
  const [searchParams] = useSearchParams();
  const { entity, entityQuery } = useSelectedEntity();
  const initialTopicId = searchParams.get('topicId');

  const handleTraceSelect = (nextSignalId: string, traceId: string) => {
    void navigate(`/signals/${nextSignalId}/traces/${traceId}${entityQuery}`);
  };

  return (
    <SignalDetailsPageContent
      signalId={signalId}
      entity={entity}
      selectedTraceId={selectedTraceId}
      initialTopicId={initialTopicId}
      onTraceSelect={handleTraceSelect}
    />
  );
}

export function SignalDetailsPage() {
  return <SignalDetailsRouteContent selectedTraceId={null} />;
}

export function SignalTraceIdPage() {
  const navigate = useNavigate();
  const { signalId, traceId } = useParams();
  const { entity, entityQuery } = useSelectedEntity();
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  const handleTraceClose = () => {
    setSelectedSpanId(null);
    void navigate(signalId ? `/signals/${signalId}${entityQuery}` : '/signals');
  };

  const handleTraceSelect = (nextSignalId: string, nextTraceId: string) => {
    void navigate(`/signals/${nextSignalId}/traces/${nextTraceId}${entityQuery}`);
  };

  return (
    <SignalDetailsPageContent
      signalId={signalId}
      entity={entity}
      selectedTraceId={traceId ?? null}
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
  );
}

export default SignalDetailsPage;
