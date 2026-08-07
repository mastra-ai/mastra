'use client';

import type { SpanRecord } from '@mastra/core/storage';
import { collectToolMocks } from '@mastra/core/utils/collect-tool-mocks';
import { safeStringify } from '@mastra/core/utils/safe-stringify';
import type { SideDialogRootProps } from '@mastra/playground-ui/components/SideDialog';
import { TextAndIcon, getShortId } from '@mastra/playground-ui/components/Text';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { EyeIcon } from 'lucide-react';
import { SaveAsDatasetItemDialog } from '@/domains/datasets/components/save-as-dataset-item-dialog';

type TraceAsItemDialogProps = {
  /** Full span record — if provided, used directly (no fetch). */
  traceDetails?: SpanRecord;
  /** Root span ID for lazy-loading when traceDetails is not available. */
  rootSpanId?: string | null;
  traceId?: string;
  isOpen: boolean;
  onClose: () => void;
  level?: SideDialogRootProps['level'];
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
  traceId,
  isOpen,
  onClose,
  level = 2,
}: TraceAsItemDialogProps) {
  const client = useMastraClient();

  // Lazy-load the root span details when dialog opens and no traceDetails provided
  const { data: lazySpanDetail } = useSpanDetail(
    !externalTraceDetails && isOpen ? traceId : null,
    !externalTraceDetails && isOpen ? rootSpanId : null,
  );

  const traceDetails = externalTraceDetails ?? lazySpanDetail?.span;

  const { data: trajectory, isLoading: isTrajectoryLoading } = useQuery({
    queryKey: ['trace-trajectory', traceId],
    queryFn: () => client.getTraceTrajectory(traceId!),
    enabled: isOpen && !!traceId,
  });

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
      breadcrumb={
        <TextAndIcon>
          <EyeIcon /> {getShortId(traceId)}
        </TextAndIcon>
      }
      isOpen={isOpen}
      onClose={onClose}
      level={level}
      source={traceId ? { type: 'trace', referenceId: traceId } : undefined}
    />
  );
}
