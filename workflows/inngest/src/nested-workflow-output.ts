import type { StepResult, StepTripwireInfo } from '@mastra/core/workflows';

export const NESTED_WORKFLOW_OUTPUT_MODE = {
  DEFAULT: 'default',
  COMPACT: 'compact',
} as const;

export type NestedWorkflowOutputMode = (typeof NESTED_WORKFLOW_OUTPUT_MODE)[keyof typeof NESTED_WORKFLOW_OUTPUT_MODE];

export type CompactNestedWorkflowResult =
  | { status: 'success'; state?: unknown; result: unknown }
  | { status: 'failed'; state?: unknown; error: unknown }
  | { status: 'tripwire'; state?: unknown; tripwire: StepTripwireInfo }
  | { status: 'suspended'; state?: unknown; steps: Record<string, StepResult<any, any, any, any>> }
  | { status: 'paused'; state?: unknown };

export function resolveNestedWorkflowOutputMode(
  mode: NestedWorkflowOutputMode | undefined = NESTED_WORKFLOW_OUTPUT_MODE.DEFAULT,
): NestedWorkflowOutputMode {
  return mode === NESTED_WORKFLOW_OUTPUT_MODE.COMPACT
    ? NESTED_WORKFLOW_OUTPUT_MODE.COMPACT
    : NESTED_WORKFLOW_OUTPUT_MODE.DEFAULT;
}

/**
 * Keeps only the status-specific fields consumed by a parent workflow after
 * `step.invoke()`. Suspended results retain steps so the parent can construct
 * the nested resume path; completed results do not carry the child input or
 * internal step history into the parent's memoized run state.
 */
export function compactNestedWorkflowResult(result: CompactNestedWorkflowResult): CompactNestedWorkflowResult {
  switch (result.status) {
    case 'success':
      return { status: result.status, result: result.result, state: result.state };
    case 'failed':
      return { status: result.status, error: result.error, state: result.state };
    case 'tripwire':
      return { status: result.status, tripwire: result.tripwire, state: result.state };
    case 'suspended':
      return { status: result.status, steps: result.steps, state: result.state };
    case 'paused':
      return { status: result.status, state: result.state };
  }
}
