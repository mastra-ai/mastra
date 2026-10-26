'use client';

import type { TrajectoryStep } from '@mastra/core/evals';
import { collectToolMocks } from '@mastra/core/utils/collect-tool-mocks';
import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { useMastraClient } from '@mastra/react';
import { useSpanDetail } from '@mastra/react/hooks/traces';
import { useQuery } from '@tanstack/react-query';
import { AddDatasetItemDialog } from '@/domains/datasets';
import type { AddDatasetItemDialogProps, TrajectoryExpectation } from '@/domains/datasets';
import type { SpanRecord } from '@/domains/traces/types';

type ExpectedStep = NonNullable<TrajectoryExpectation['steps']>[number];

type TraceAsItemDialogProps = {
  /** Full span record — if provided, used directly (no fetch). */
  traceDetails?: SpanRecord;
  /** Root span ID for lazy-loading when traceDetails is not available. */
  rootSpanId?: string | null;
  traceId?: string;
  isOpen: boolean;
  onClose: () => void;
  renderCreateDatasetDialog?: AddDatasetItemDialogProps['renderCreateDatasetDialog'];
};

const readsAsJson = (text: string) => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/** Strings show as plain text, unless the text reads as JSON: those stay quoted so they are saved back as strings. */
function toEditorText(value: unknown): string {
  if (typeof value === 'string' && !readsAsJson(value)) return value;
  return safeStringify(value, 2);
}

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

  return toEditorText(rawInput);
}

/** A recorded step as an expectation: what it did, without how long it took or what ran inside it. */
function toExpectedStep(step: TrajectoryStep): ExpectedStep {
  // Expectations can't type provider-executed tools yet, so those match by name only.
  if (step.stepType === 'provider_tool_call') return { name: step.name };
  const { children: _children, durationMs: _durationMs, metadata: _metadata, ...expected } = step;
  return expected;
}

export function TraceAsItemDialog({
  traceDetails: externalTraceDetails,
  rootSpanId,
  traceId,
  isOpen,
  onClose,
  renderCreateDatasetDialog,
}: TraceAsItemDialogProps) {
  const client = useMastraClient();

  // Lazy-load the root span details when dialog opens and no traceDetails provided
  const spanTraceId = !externalTraceDetails && isOpen ? traceId : null;
  const spanId = !externalTraceDetails && isOpen ? rootSpanId : null;
  const { data: lazySpanDetail, isLoading: isSpanLoading } = useSpanDetail({
    traceId: spanTraceId,
    spanId,
    queryOptions: { enabled: Boolean(spanTraceId) && Boolean(spanId) },
  });

  const traceDetails = externalTraceDetails ?? lazySpanDetail?.span;

  const { data: trajectory, isLoading: isTrajectoryLoading } = useQuery({
    queryKey: ['trace-trajectory', traceId],
    queryFn: () => client.getTraceTrajectory(traceId ?? ''),
    enabled: isOpen && Boolean(traceId),
  });

  // The dialog seeds its form when it opens, so it opens once everything the form is seeded from has arrived.
  const isReady = !isSpanLoading && !isTrajectoryLoading;
  const steps = trajectory?.steps ?? [];
  // Derive item-level tool mocks from the recorded tool calls in the trajectory
  const toolMocks = collectToolMocks(steps);

  return (
    <AddDatasetItemDialog
      open={isOpen && isReady}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      initialInput={getInitialInput(traceDetails)}
      initialGroundTruth={traceDetails?.output != null ? toEditorText(traceDetails.output) : ''}
      initialToolMocks={toolMocks.length > 0 ? safeStringify(toolMocks, 2) : undefined}
      initialTrajectory={steps.length > 0 ? { steps: steps.map(toExpectedStep), ordering: 'relaxed' } : undefined}
      source={traceId ? { type: 'trace', referenceId: traceId } : undefined}
      renderCreateDatasetDialog={renderCreateDatasetDialog}
    />
  );
}
