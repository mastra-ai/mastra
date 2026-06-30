import {
  SignalDetailsPage as SignalDetailsPageContent,
  SignalTraceDetailsPanel,
} from '@mastra/playground-ui/ee/signals/components/signal-details-page';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

function useSelectedEntity() {
  const [searchParams] = useSearchParams();
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const entity = entityType && entityId ? { entityType, entityId } : null;
  const entityQuery = entity
    ? `?entityType=${encodeURIComponent(entityType!)}&entityId=${encodeURIComponent(entityId!)}`
    : '';

  return { entity, entityQuery };
}

function SignalDetailsRouteContent({ selectedTraceId }: { selectedTraceId: string | null }) {
  const navigate = useNavigate();
  const { signalId } = useParams();
  const { entity, entityQuery } = useSelectedEntity();

  const handleTraceSelect = (nextSignalId: string, traceId: string) => {
    void navigate(`/signals/${nextSignalId}/traces/${traceId}${entityQuery}`);
  };

  return (
    <SignalDetailsPageContent
      signalId={signalId}
      entity={entity}
      selectedTraceId={selectedTraceId}
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
