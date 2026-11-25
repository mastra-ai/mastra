'use client';

import { useTraceAsItemData } from '../hooks/use-trace-as-item-data';
import { TraceDatasetItemDialog } from './trace-dataset-item-dialog';
import type { TraceDatasetItemDialogProps } from './trace-dataset-item-dialog';
import type { SpanRecord } from '@/domains/traces/types';

type TraceAsItemDialogProps = {
  /** Full span record — if provided, used directly (no fetch). */
  traceDetails?: SpanRecord;
  /** Root span ID for lazy-loading when traceDetails is not available. */
  rootSpanId?: string | null;
  traceId?: string;
  isOpen: boolean;
  onClose: () => void;
  renderCreateDatasetDialog?: TraceDatasetItemDialogProps['renderCreateDatasetDialog'];
};

/**
 * @deprecated Use `TraceDatasetItemDialog` with `useTraceAsItemData`. This dialog reads the trace
 * through the same Mastra client it saves with, so the trace and the dataset must share a server.
 */
export function TraceAsItemDialog({ traceDetails, rootSpanId, traceId, isOpen, ...props }: TraceAsItemDialogProps) {
  const data = useTraceAsItemData({ traceId, rootSpanId: traceDetails ? null : rootSpanId, enabled: isOpen });

  return (
    <TraceDatasetItemDialog
      {...props}
      {...data}
      rootSpan={traceDetails ?? data.rootSpan}
      traceId={traceId}
      isOpen={isOpen}
    />
  );
}
