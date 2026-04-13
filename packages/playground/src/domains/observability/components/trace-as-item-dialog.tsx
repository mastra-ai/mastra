'use client';

import type { SpanRecord } from '@mastra/core/storage';
import { TextAndIcon, getShortId } from '@mastra/playground-ui';
import type { SideDialogRootProps } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { EyeIcon } from 'lucide-react';
import { SaveAsDatasetItemDialog } from '@/domains/datasets/components/save-as-dataset-item-dialog';

type TraceAsItemDialogProps = {
  traceDetails?: SpanRecord;
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

  return JSON.stringify(rawInput, null, 2);
}

export function TraceAsItemDialog({ traceDetails, traceId, isOpen, onClose, level = 2 }: TraceAsItemDialogProps) {
  const client = useMastraClient();

  const { data: trajectory, isLoading: isTrajectoryLoading } = useQuery({
    queryKey: ['trace-trajectory', traceId],
    queryFn: () => client.getTraceTrajectory(traceId!),
    enabled: isOpen && !!traceId,
  });

  // Convert trajectory to a TrajectoryExpectation JSON string
  const initialTrajectory =
    trajectory?.steps && trajectory.steps.length > 0
      ? JSON.stringify(
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
          null,
          2,
        )
      : undefined;

  return (
    <SaveAsDatasetItemDialog
      initialInput={getInitialInput(traceDetails)}
      initialGroundTruth={traceDetails?.output != null ? JSON.stringify(traceDetails.output, null, 2) : ''}
      initialTrajectory={initialTrajectory}
      trajectoryLoading={isTrajectoryLoading}
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
