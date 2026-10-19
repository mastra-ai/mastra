'use client';

import { collectToolMocks } from '@mastra/core/utils/collect-tool-mocks';
import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { useMastraClient } from '@mastra/react';
import { useSpanDetail } from '@mastra/react/hooks/traces';
import { useQuery } from '@tanstack/react-query';
import { SaveAsDatasetItemDialog } from '@/domains/datasets';
import type { SaveAsDatasetItemDialogProps } from '@/domains/datasets';
import type { SpanRecord } from '@/domains/traces/types';
import type { DataPanelProps } from '@/ds/components/DataPanel';
import { getShortId } from '@/ds/components/Text';

type TraceAsItemDialogProps = {
  /** Full span record — if provided, used directly (no fetch). */
  traceDetails?: SpanRecord;
  /** Root span ID for lazy-loading when traceDetails is not available. */
  rootSpanId?: string | null;
  /**
   * Saves this one span instead of the full trace: its input and output are loaded, and the
   * trace-wide trajectory and tool mocks are left out since they describe the whole trace.
   */
  spanId?: string;
  traceId?: string;
  isOpen: boolean;
  onClose: () => void;
  depth?: DataPanelProps['depth'];
  renderCreateDatasetDialog?: SaveAsDatasetItemDialogProps['renderCreateDatasetDialog'];
};

function getInitialInput(traceDetails?: SpanRecord): string {
  if (traceDetails?.input == null) return '{}';

  // Unwrap legacy { messages } wrapper from agent_run spans so the dataset item stores a valid MessageListInput
  const spanInput = traceDetails.input as Record<string, unknown> | undefined;
  const isWrappedAgentInput =
    traceDetails.spanType === 'agent_run' &&
    spanInput &&
    typeof spanInput === 'object' &&
    !Array.isArray(spanInput) &&
    'messages' in spanInput;
  const rawInput = isWrappedAgentInput ? (spanInput.messages ?? traceDetails.input) : traceDetails.input;

  return safeStringify(rawInput, 2);
}

export function TraceAsItemDialog({
  traceDetails: externalTraceDetails,
  rootSpanId,
  spanId,
  traceId,
  isOpen,
  onClose,
  depth,
  renderCreateDatasetDialog,
}: TraceAsItemDialogProps) {
  const client = useMastraClient();

  const isSingleSpan = !!spanId;
  const spanIdToLoad = spanId ?? rootSpanId;

  // Lazy-load the span details when dialog opens and no traceDetails provided
  const shouldLoadSpan = !externalTraceDetails && isOpen;
  const { data: lazySpanDetail } = useSpanDetail({
    traceId: shouldLoadSpan ? traceId : undefined,
    spanId: shouldLoadSpan ? spanIdToLoad : undefined,
    queryOptions: { enabled: shouldLoadSpan && !!traceId && !!spanIdToLoad },
  });

  const traceDetails = externalTraceDetails ?? lazySpanDetail?.span;

  const { data: traceTrajectory, isLoading: isTrajectoryLoading } = useQuery({
    queryKey: ['trace-trajectory', traceId],
    queryFn: () => client.getTraceTrajectory(traceId ?? ''),
    enabled: isOpen && !!traceId && !isSingleSpan,
  });
  // The disabled query still returns a trajectory cached by an earlier full-trace save.
  const trajectory = isSingleSpan ? undefined : traceTrajectory;

  // Convert trajectory to a TrajectoryExpectation JSON string
  const initialTrajectory =
    trajectory?.steps && trajectory.steps.length > 0
      ? safeStringify(
          {
            steps: trajectory.steps.map(step => {
              const { name, stepType, children, ...rest } = step as Record<string, unknown>;
              const expected: Record<string, unknown> = { name, stepType };
              for (const [k, v] of Object.entries(rest)) {
                if (v != null && k !== 'durationMs' && k !== 'metadata') {
                  expected[k] = v;
                }
              }
              return expected;
            }),
            ordering: 'relaxed',
          },
          2,
        )
      : undefined;

  // Derive item-level tool mocks from the recorded tool calls in the trajectory
  const toolMocks = trajectory?.steps ? collectToolMocks(trajectory.steps) : [];
  const initialToolMocks = toolMocks.length > 0 ? safeStringify(toolMocks, 2) : undefined;

  return (
    <SaveAsDatasetItemDialog
      initialInput={getInitialInput(traceDetails)}
      initialGroundTruth={traceDetails?.output != null ? safeStringify(traceDetails.output, 2) : ''}
      initialTrajectory={initialTrajectory}
      trajectoryLoading={isTrajectoryLoading}
      initialToolMocks={initialToolMocks}
      breadcrumb={getShortId(traceId)}
      isOpen={isOpen}
      onClose={onClose}
      depth={depth}
      source={traceId ? { type: 'trace', referenceId: traceId } : undefined}
      renderCreateDatasetDialog={renderCreateDatasetDialog}
    />
  );
}
