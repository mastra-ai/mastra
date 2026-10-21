import { TraceSpanPanel as SharedTraceSpanPanel } from '@mastra/playground-ui/domains/traces/components/trace-span-panel';
import type { ComponentProps } from 'react';
import { LiveKitRecordingReview } from '@/domains/voice/components/livekit-recording-review';

type TraceSpanPanelProps = Omit<ComponentProps<typeof SharedTraceSpanPanel>, 'headerActionsSlot'>;

/** Adds Studio's recording review action to the shared trace panel. */
export function TraceSpanPanel(props: TraceSpanPanelProps) {
  return (
    <SharedTraceSpanPanel
      {...props}
      headerActionsSlot={
        props.traceId ? (
          <LiveKitRecordingReview key={props.traceId} traceId={props.traceId} spans={props.spans} />
        ) : undefined
      }
    />
  );
}
