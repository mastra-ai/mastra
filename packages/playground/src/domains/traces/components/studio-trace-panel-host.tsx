import { TracePanelHostProvider } from '@mastra/playground-ui/domains/traces/components/trace-panel-host';
import type { TracePanelHost } from '@mastra/playground-ui/domains/traces/components/trace-panel-host';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import { LiveKitRecordingReview } from '@/domains/voice/components/livekit-recording-review';
import { traceScoreLink } from '@/lib/app-routing';

const renderHeaderActions: TracePanelHost['renderHeaderActions'] = ({ traceId, spans }) => (
  <LiveKitRecordingReview key={traceId} traceId={traceId} spans={spans} />
);

const renderCreateDatasetDialog: TracePanelHost['renderCreateDatasetDialog'] = props => (
  <CreateDatasetDialog {...props} />
);

/** Studio's trace drawer integrations: score routing, the LiveKit recording review and dataset creation. */
export function StudioTracePanelHost({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  // Context value: kept stable so trace panels don't re-render when the layout does.
  const host = useMemo<TracePanelHost>(
    () => ({
      openScore: (traceId, scoreId) => navigate(traceScoreLink(traceId, scoreId)),
      renderHeaderActions,
      renderCreateDatasetDialog,
    }),
    [navigate],
  );

  return <TracePanelHostProvider value={host}>{children}</TracePanelHostProvider>;
}
