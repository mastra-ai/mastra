'use client';

import type { Trajectory, TrajectoryStep } from '@mastra/core/evals';
import { collectToolMocks } from '@mastra/core/utils/collect-tool-mocks';
import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { AddDatasetItemDialog } from '@/domains/datasets';
import type { AddDatasetItemDialogProps, TrajectoryExpectation } from '@/domains/datasets';
import type { SpanRecord } from '@/domains/traces/types';

type ExpectedStep = NonNullable<TrajectoryExpectation['steps']>[number];

export type TraceDatasetItemDialogProps = {
  traceId?: string;
  /** The trace's root span: its input and output prefill the item (see `useTraceAsItemData`). */
  rootSpan?: SpanRecord;
  /** The trace's trajectory: its steps prefill the expected trajectory and tool mocks. */
  trajectory?: Pick<Trajectory, 'steps'>;
  /** While true the dialog stays closed, so its form is seeded once everything has arrived. */
  isLoading?: boolean;
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

/**
 * Saves a trace as a dataset item, prefilled from its root span and trajectory. It reads nothing
 * itself: the host loads the trace (`useTraceAsItemData`) and the dialog saves through the Mastra
 * client in context, so the trace and the dataset can come from different servers.
 */
export function TraceDatasetItemDialog({
  traceId,
  rootSpan,
  trajectory,
  isLoading = false,
  isOpen,
  onClose,
  renderCreateDatasetDialog,
}: TraceDatasetItemDialogProps) {
  const steps = trajectory?.steps ?? [];
  // Derive item-level tool mocks from the recorded tool calls in the trajectory
  const toolMocks = collectToolMocks(steps);

  return (
    <AddDatasetItemDialog
      open={isOpen && !isLoading}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      initialInput={getInitialInput(rootSpan)}
      initialGroundTruth={rootSpan?.output != null ? toEditorText(rootSpan.output) : ''}
      initialToolMocks={toolMocks.length > 0 ? safeStringify(toolMocks, 2) : undefined}
      initialTrajectory={steps.length > 0 ? { steps: steps.map(toExpectedStep), ordering: 'relaxed' } : undefined}
      source={traceId ? { type: 'trace', referenceId: traceId } : undefined}
      renderCreateDatasetDialog={renderCreateDatasetDialog}
    />
  );
}
