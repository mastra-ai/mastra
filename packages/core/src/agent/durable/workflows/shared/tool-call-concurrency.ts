import { DurableAgentDefaults } from '../../constants';
import type { SerializableDurableOptions, SerializableToolMetadata } from '../../types';

/**
 * Resolves the effective tool-call foreach concurrency for a durable agentic
 * workflow from the serialized workflow input (iteration state).
 *
 * Mirrors @mastra/core's non-durable loop semantics
 * (loop/workflows/agentic-execution/tool-call-concurrency.ts):
 * - Global `requireToolApproval` forces sequential execution. The serialized
 *   boolean shadow is `true` for function-form policies, so those degrade
 *   safely to sequential as well.
 * - Any registered tool (filtered by `activeTools` when set) with
 *   `requireApproval` or `hasSuspendSchema` forces sequential execution so
 *   approval/suspension flows never race with concurrent tool calls.
 * - Otherwise the configured `toolCallConcurrency` applies
 *   (default {@link DurableAgentDefaults.TOOL_CALL_CONCURRENCY}).
 *
 * Designed to be called from a foreach concurrency resolver at execution
 * time, reading only serialized state — safe across durable-engine replays
 * and shared workflow instances.
 */
export function resolveDurableToolCallConcurrency({
  options,
  toolsMetadata,
}: {
  options?: Pick<SerializableDurableOptions, 'requireToolApproval' | 'toolCallConcurrency' | 'activeTools'>;
  toolsMetadata?: SerializableToolMetadata[];
}): number {
  if (options?.requireToolApproval) {
    return 1;
  }

  const activeTools = options?.activeTools;
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
