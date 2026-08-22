import { SideDialog } from '@mastra/playground-ui/components/SideDialog';
import { SpanDetailsView } from '@mastra/playground-ui/domains/traces/components/span-details-view';
import { TraceDetailsView } from '@mastra/playground-ui/domains/traces/components/trace-details-view';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useTraceLightSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-light-spans';
import { useState } from 'react';

export function ThreadTraceInspector({ traceId, onClose }: { traceId: string; onClose: () => void }) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>();
  const { data: traceLight, isLoading } = useTraceLightSpans(traceId);
  const { data: spanDetailData, isLoading: isLoadingSpan } = useSpanDetail(traceId, selectedSpanId ?? '');

  return (
    <SideDialog dialogTitle="Trace details" dialogDescription="Technical trace for this turn" isOpen onClose={onClose}>
      <SideDialog.Content>
        <div className="grid content-start gap-4">
          <TraceDetailsView
            traceId={traceId}
            spans={traceLight?.spans}
            isLoading={isLoading}
            onClose={onClose}
            onSpanSelect={setSelectedSpanId}
            selectedSpanId={selectedSpanId}
          />
          {selectedSpanId && (
            <SpanDetailsView
              spanId={selectedSpanId}
              span={spanDetailData?.span}
              isLoading={isLoadingSpan}
              onClose={() => setSelectedSpanId(undefined)}
            />
          )}
        </div>
      </SideDialog.Content>
    </SideDialog>
  );
}
