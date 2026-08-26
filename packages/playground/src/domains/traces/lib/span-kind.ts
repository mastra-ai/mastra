import type { TimelineSpan } from './build-thread-timeline';

/**
 * The short, all-caps category shown in the timeline gutter. It answers "what kind of step is
 * this?" in one word, while the label next to it answers "which one?".
 */
export function spanKind(span: TimelineSpan): string {
  switch (span.spanType) {
    case 'model_generation':
      return 'MODEL';
    case 'tool_call':
    case 'client_tool_call':
    case 'provider_tool_call':
    case 'mcp_tool_call':
      return 'TOOL';
    case 'processor_run':
      return 'PROCESSOR';
    case 'workflow_run':
      return 'WORKFLOW';
    case 'workflow_step':
      return 'STEP';
    case 'workspace_action':
      return 'WORKSPACE';
    default:
      return 'STEP';
  }
}

/** Seconds elapsed since the turn started, as shown in the gutter (`0.0s`, `3.2s`). */
export function formatOffset(startedAt: TimelineSpan['startedAt'], turnStart: number | undefined): string | undefined {
  if (turnStart === undefined || !startedAt) return undefined;
  const time = startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime();
  if (Number.isNaN(time)) return undefined;
  const seconds = (time - turnStart) / 1000;
  if (seconds < 0) return undefined;
  return `${seconds.toFixed(1)}s`;
}
