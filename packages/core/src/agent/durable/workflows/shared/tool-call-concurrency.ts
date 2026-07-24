import { resolveToolCallConcurrencyStrategy } from '../../../../loop/workflows/agentic-execution/tool-call-concurrency';
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
 *   flows never race with concurrent tool calls. By default (`'available'`
 *   strategy) the check is against the active tool set, NOT the tools the model
 *   actually called: a registered suspending/approval tool the model skipped
 *   this step still forces sequential execution, since a concurrently-running
 *   sibling tool would race the suspension. The opt-in `'called'` strategy
 *   (via `toolCallConcurrency: { strategy: 'called' }`) narrows the check to the
 *   tools actually called this step — an uncalled tool cannot suspend, so a
 *   batch of purely safe calls runs concurrently even while an approval/suspend
 *   tool stays registered. A batch that *does* call one still runs sequentially.
 * - Otherwise the configured `toolCallConcurrency` limit applies
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
  toolCalls?: Pick<DurableToolCallInput, 'activeTools' | 'toolName'>[];
}): number {
  if (options?.requireToolApproval) {
    return 1;
  }

  let requiresSequential: boolean;
  if (resolveToolCallConcurrencyStrategy(options?.toolCallConcurrency) === 'called') {
    // `'called'` strategy: only tools actually invoked this step can suspend it.
    const called = new Set((toolCalls ?? []).map(tc => tc.toolName).filter(Boolean));
    requiresSequential = (toolsMetadata ?? []).some(
      tool => called.has(tool.name) && Boolean(tool.hasSuspendSchema || tool.requireApproval),
    );
  } else {
    // Default `'available'` strategy: any approval/suspend tool in the step's
    // effective active tool set forces sequential execution.
    const stamped = toolCalls?.find(tc => tc.activeTools !== undefined);
    const activeTools = stamped ? stamped.activeTools : options?.activeTools;
    const consideredTools =
      activeTools === undefined || activeTools === null
        ? (toolsMetadata ?? [])
        : (toolsMetadata ?? []).filter(tool => activeTools.includes(tool.name));
    requiresSequential = consideredTools.some(tool => Boolean(tool.hasSuspendSchema || tool.requireApproval));
  }

  if (requiresSequential) {
    return 1;
  }

  const configuredValue = options?.toolCallConcurrency;
  const configured = typeof configuredValue === 'object' ? configuredValue.limit : configuredValue;
  return typeof configured === 'number' && configured > 0 ? configured : DurableAgentDefaults.TOOL_CALL_CONCURRENCY;
}
