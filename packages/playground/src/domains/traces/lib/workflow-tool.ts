import type { TimelineSpan } from './build-thread-timeline';

const TOOL_TYPES = new Set(['tool_call', 'client_tool_call', 'provider_tool_call']);

/**
 * Agents call workflows as tools, and core names those tools `workflow-<id>` — a convention it
 * reads back itself when resolving a call. The span is a tool call, but the step the reader cares
 * about is the workflow, so the timeline labels and marks it as one.
 */
export function isWorkflowTool(span: TimelineSpan): boolean {
  if (!TOOL_TYPES.has(span.spanType ?? '')) return false;
  const id = span.entityId ?? span.name ?? '';
  return id.startsWith('workflow-');
}
