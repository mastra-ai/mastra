import { DurableAgentDefaults } from '../../constants';
import type { DurableToolCallInput, SerializableDurableOptions, SerializableToolMetadata } from '../../types';

/**
 * Resolves the effective tool-call foreach concurrency for a durable agentic
 * workflow from the serialized workflow input (iteration state) and the
 * step's tool calls.
 *
 * Mirrors @mastra/core's non-durable loop semantics
 * (loop/workflows/agentic-execution/tool-call-concurrency.ts):
 * - Global `requireToolApproval` forces sequential execution. The serialized
 *   boolean shadow is `true` for function-form policies, so those degrade
 *   safely to sequential as well.
 * - Any tool in the step's *effective active tool set* with `requireApproval`
 *   or `hasSuspendSchema` forces sequential execution so approval/suspension
 *   flows never race with concurrent tool calls. The check is against the
 *   active tool set, NOT the tools the model actually called: a registered
 *   suspending/approval tool the model skipped this step must still force
 *   sequential execution, since a concurrently-running sibling tool would
 *   race the suspension.
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
}: {
  options?: Pick<SerializableDurableOptions, 'requireToolApproval' | 'toolCallConcurrency' | 'activeTools'>;
  toolsMetadata?: SerializableToolMetadata[];
  toolCalls?: Pick<DurableToolCallInput, 'activeTools'>[];
}): number {
  if (options?.requireToolApproval) {
    return 1;
  }

  const stamped = toolCalls?.find(tc => tc.activeTools !== undefined);
  const activeTools = stamped ? stamped.activeTools : options?.activeTools;
  const consideredTools =
    activeTools === undefined || activeTools === null
      ? (toolsMetadata ?? [])
      : (toolsMetadata ?? []).filter(tool => activeTools.includes(tool.name));

  if (consideredTools.some(tool => tool.hasSuspendSchema || tool.requireApproval)) {
    return 1;
  }

  const configured = options?.toolCallConcurrency;
  return typeof configured === 'number' && configured > 0 ? configured : DurableAgentDefaults.TOOL_CALL_CONCURRENCY;
}
