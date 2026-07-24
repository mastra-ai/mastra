import type { ToolSet } from '@internal/ai-sdk-v5';
import type { RequireToolApproval } from '../../../tools';

export type ToolCallForeachOptions = {
  concurrency: number;
};

/**
 * How the sequential-vs-parallel decision is made when the agent has an
 * approval/suspending tool available:
 * - `'available'` (default): any such tool *available* in the step forces the
 *   whole batch sequential, even if the model did not call it this step. This
 *   is the conservative behavior — a suspend can never race a sibling.
 * - `'called'`: only tools the model *actually called* this step are checked.
 *   An available-but-uncalled approval/suspend tool no longer serializes a
 *   batch of purely safe calls. Safe because a tool that was not called cannot
 *   suspend this step; a batch that *does* call an approval/suspend tool still
 *   runs sequentially. Opt-in for agents that keep an approval tool registered
 *   across a run but never mix it into the same batch as parallelizable calls.
 */
export type ToolCallConcurrencyStrategy = 'available' | 'called';

/**
 * Tool-call concurrency configuration. Either a plain number (the concurrency
 * limit, `'available'` strategy) or an object selecting the limit and strategy.
 */
export type ToolCallConcurrency = number | { limit?: number; strategy?: ToolCallConcurrencyStrategy };

export function resolveConfiguredToolCallConcurrency(toolCallConcurrency: ToolCallConcurrency | undefined): number {
  const limit = typeof toolCallConcurrency === 'object' ? toolCallConcurrency.limit : toolCallConcurrency;
  return limit && limit > 0 ? limit : 10;
}

export function resolveToolCallConcurrencyStrategy(
  toolCallConcurrency: ToolCallConcurrency | undefined,
): ToolCallConcurrencyStrategy {
  return (typeof toolCallConcurrency === 'object' && toolCallConcurrency.strategy) || 'available';
}

export function effectiveToolSetRequiresSequentialExecution({
  requireToolApproval,
  tools,
  activeTools,
  calledToolNames,
}: {
  // A function-valued global approval policy is evaluated per call at execution time;
  // before args are known we conservatively treat it like `true` and force sequential
  // execution so approval suspensions never race with concurrent tool calls.
  requireToolApproval?: RequireToolApproval;
  tools?: ToolSet;
  activeTools?: readonly string[];
  // Tool names actually called this step. When provided (the `'called'`
  // strategy), only these tools are checked for suspend/approval — an
  // available-but-uncalled tool cannot suspend this step, so it must not force
  // the batch sequential. When undefined (default `'available'` strategy) the
  // whole effective active tool set is checked.
  calledToolNames?: readonly string[];
}): boolean {
  if (requireToolApproval) {
    return true;
  }

  if (!tools) {
    return false;
  }

  const suspendsOrRequiresApproval = (tool: unknown): boolean => {
    const maybeTool = tool as { hasSuspendSchema?: unknown; requireApproval?: unknown };
    return Boolean(maybeTool?.hasSuspendSchema || maybeTool?.requireApproval);
  };

  // `'called'` strategy: only tools invoked this step can suspend this step.
  if (calledToolNames !== undefined) {
    return calledToolNames.some(toolName => suspendsOrRequiresApproval(tools[toolName]));
  }

  // Default `'available'` strategy: any approval/suspend tool available in the
  // step's effective active tool set forces sequential execution.
  const activeToolEntries =
    activeTools === undefined
      ? Object.entries(tools)
      : activeTools.flatMap(toolName => {
          const tool = tools[toolName];
          return tool ? ([[toolName, tool]] as const) : [];
        });

  return activeToolEntries.some(([, tool]) => suspendsOrRequiresApproval(tool));
}

export function resolveToolCallConcurrency({
  requireToolApproval,
  tools,
  activeTools,
  calledToolNames,
  configuredConcurrency,
}: {
  requireToolApproval?: RequireToolApproval;
  tools?: ToolSet;
  activeTools?: readonly string[];
  calledToolNames?: readonly string[];
  configuredConcurrency: number;
}): number {
  return effectiveToolSetRequiresSequentialExecution({
    requireToolApproval,
    tools,
    activeTools,
    calledToolNames,
  })
    ? 1
    : configuredConcurrency;
}

export function updateToolCallForeachConcurrency(
  options: ToolCallForeachOptions,
  args: Parameters<typeof resolveToolCallConcurrency>[0],
) {
  options.concurrency = resolveToolCallConcurrency(args);
}
