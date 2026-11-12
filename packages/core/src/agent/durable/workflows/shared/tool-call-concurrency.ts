import { normalizeToolCallConcurrency } from '../../../../loop/workflows/agentic-execution/tool-call-concurrency';
import { DurableAgentDefaults } from '../../constants';
import type { DurableToolCallInput, SerializableDurableOptions, SerializableToolMetadata } from '../../types';

/**
 * Resolves the effective tool-call foreach concurrency for a durable agentic
 * workflow from the serialized workflow input (iteration state) and the
 * step's tool calls.
 *
 * Mirrors @mastra/core's non-durable loop semantics
 * (loop/workflows/agentic-execution/tool-call-concurrency.ts):
 * - Approval never forces sequential execution. An approval-gated call parks
 *   before it executes, so every gated call in the step reaches its gate at
 *   once and is resumed by its own toolCallId (#30152). The exception is a
 *   delegated sub-agent run (`serializeApprovals`): its delegation surfaces one
 *   pause at a time and resumes without a target, so there approval-gated tools
 *   keep forcing sequential execution.
 * - Any tool in the step's *effective active tool set* with `hasSuspendSchema`
 *   forces sequential execution so suspension flows never race with
 *   concurrent tool calls. The check is against the active tool set, NOT the
 *   tools the model actually called: a registered suspending tool the model
 *   skipped this step must still force sequential execution, since a
 *   concurrently-running sibling tool would race the suspension.
 * - Otherwise the configured `toolCallConcurrency` applies
 *   (default {@link DurableAgentDefaults.TOOL_CALL_CONCURRENCY}).
 *
 * The active tool set is the `activeTools` allowlist the LLM step stamps on
 * each tool call (processors may narrow or clear it; all calls in one step
 * share the value, `null` = restriction cleared → unrestricted). When the
 * calls carry no stamp, the run-level `activeTools` option applies.
 *
 * Designed to be called from a foreach concurrency resolver at execution
 * time, reading only serialized state — safe across durable-engine replays
 * and shared workflow instances.
 */
export function resolveDurableToolCallConcurrency({
  options,
  toolsMetadata,
  toolCalls,
  serializeApprovals = false,
}: {
  options?: Pick<SerializableDurableOptions, 'requireToolApproval' | 'toolCallConcurrency' | 'activeTools'>;
  toolsMetadata?: SerializableToolMetadata[];
  toolCalls?: Pick<DurableToolCallInput, 'activeTools' | 'toolName' | 'requireApproval' | 'hasSuspendSchema'>[];
  serializeApprovals?: boolean;
}): number {
  if (serializeApprovals && options?.requireToolApproval) {
    return 1;
  }

  // Step-stamped capability flags cover tools that input processors added for
  // this step (e.g. via ToolSearchProcessor). Those tools never appear in the
  // run-start `toolsMetadata`, so the metadata lookups below cannot see them.
  // The stamps are persisted with the tool calls, so this stays correct across
  // cold durable resumes (issue #24377).
  if (toolCalls?.some(tc => tc.hasSuspendSchema || (serializeApprovals && tc.requireApproval))) {
    return 1;
  }

  const { limit, strategy } = normalizeToolCallConcurrency(options?.toolCallConcurrency);

  let consideredTools: SerializableToolMetadata[];
  if (strategy === 'called') {
    // Opt-in: consider only the tools the model actually called this step. A
    // batch that never called a suspend-capable tool cannot suspend this step,
    // so it may run at the configured concurrency.
    const calledNames = new Set((toolCalls ?? []).map(tc => tc.toolName).filter((name): name is string => !!name));
    consideredTools = (toolsMetadata ?? []).filter(tool => calledNames.has(tool.name));
  } else {
    // Default: consider the step's effective active tool set (a registered
    // suspend-capable tool forces sequential even if the model skipped it).
    const stamped = toolCalls?.find(tc => tc.activeTools !== undefined);
    const activeTools = stamped ? stamped.activeTools : options?.activeTools;
    consideredTools =
      activeTools === undefined || activeTools === null
        ? (toolsMetadata ?? [])
        : (toolsMetadata ?? []).filter(tool => activeTools.includes(tool.name));
  }

  if (consideredTools.some(tool => tool.hasSuspendSchema || (serializeApprovals && tool.requireApproval))) {
    return 1;
  }

  return limit > 0 ? limit : DurableAgentDefaults.TOOL_CALL_CONCURRENCY;
}
