import type { EntryRendererProps } from './types';

/**
 * Types whose renderer opens onto the span's own payload, so the row leaves the generic details
 * disclosure off: a tool call — and a workflow, which is drawn as one — expands into its arguments
 * and result, a processor run into what it received and returned, a model generation into the
 * messages it received, and what a model produced is the ANSWER row, its cost the meta line. Two
 * disclosures side by side on one row would only ask the reader which one to trust.
 */
const SELF_CONTAINED_TYPES = new Set([
  'tool_call',
  'client_tool_call',
  'provider_tool_call',
  'mcp_tool_call',
  'model_generation',
  'processor_run',
  'workflow_run',
  'workflow_step',
]);

export function rendersOwnPayload(span: EntryRendererProps['span']): boolean {
  return SELF_CONTAINED_TYPES.has(span.spanType ?? '');
}
