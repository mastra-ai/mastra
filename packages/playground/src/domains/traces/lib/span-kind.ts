import { format } from 'date-fns';

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
      // Raw rendering: show the real span type rather than collapsing it into a generic step,
      // so unmapped types stay visible while we decide what deserves a label of its own.
      return span.spanType ? span.spanType.replace(/[_-]+/g, ' ').toUpperCase() : 'STEP';
  }
}

/** Wall clock of the step, shown in the gutter (`20:41:02`) so every row is placed in real time. */
export function formatClock(startedAt: TimelineSpan['startedAt']): string | undefined {
  if (!startedAt) return undefined;
  const date = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (Number.isNaN(date.getTime())) return undefined;
  return format(date, 'HH:mm:ss');
}
