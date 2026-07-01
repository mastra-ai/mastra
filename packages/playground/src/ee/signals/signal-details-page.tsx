import {
  SignalDetailsPage as SignalDetailsPageContent,
  SignalTraceDetailsPanel,
} from '@mastra/playground-ui/ee/signals/components/signal-details-page';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

function SignalDetailsRouteContent({ selectedTraceId }: { selectedTraceId: string | null }) {
  const navigate = useNavigate();
  const { signalId } = useParams();

  const handleTraceSelect = (nextSignalId: string, traceId: string) => {
    void navigate(`/signals/${nextSignalId}/traces/${traceId}`);
  };

  return (
    <SignalDetailsPageContent signalId={signalId} selectedTraceId={selectedTraceId} onTraceSelect={handleTraceSelect} />
  );
}

export function SignalDetailsPage() {
  return <SignalDetailsRouteContent selectedTraceId={null} />;
}

export function SignalTraceIdPage() {
  const navigate = useNavigate();
  const { signalId, traceId } = useParams();
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  const handleTraceClose = () => {
    setSelectedSpanId(null);
    void navigate(signalId ? `/signals/${signalId}` : '/signals');
  };

  const handleTraceSelect = (nextSignalId: string, nextTraceId: string) => {
    void navigate(`/signals/${nextSignalId}/traces/${nextTraceId}`);
  };

  return (
    <SignalDetailsPageContent
      signalId={signalId}
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
