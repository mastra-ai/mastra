import type { ToolSet } from '@internal/ai-sdk-v5';
import type { RequireToolApproval } from '../../../tools';

export type ToolCallForeachOptions = {
  concurrency: number;
};

export function resolveConfiguredToolCallConcurrency(toolCallConcurrency: number | undefined): number {
  return toolCallConcurrency && toolCallConcurrency > 0 ? toolCallConcurrency : 10;
}

export function effectiveToolSetRequiresSequentialExecution({
  requireToolApproval,
  tools,
  activeTools,
}: {
  // A function-valued global approval policy is evaluated per call at execution time;
  // before args are known we conservatively treat it like `true` and force sequential
  // execution so approval suspensions never race with concurrent tool calls.
  requireToolApproval?: RequireToolApproval;
  tools?: ToolSet;
  activeTools?: readonly string[];
}): boolean {
  if (requireToolApproval) {
    return true;
  }

  if (!tools) {
    return false;
  }

  const activeToolEntries =
    activeTools === undefined
      ? Object.entries(tools)
      : activeTools.flatMap(toolName => {
          const tool = tools[toolName];
          return tool ? ([[toolName, tool]] as const) : [];
        });

  return activeToolEntries.some(([, tool]) => {
    const maybeTool = tool as { hasSuspendSchema?: unknown; requireApproval?: unknown };
    return Boolean(maybeTool.hasSuspendSchema || maybeTool.requireApproval);
  });
}

export function resolveToolCallConcurrency({
  requireToolApproval,
  tools,
  activeTools,
  configuredConcurrency,
}: {
  requireToolApproval?: RequireToolApproval;
  tools?: ToolSet;
  activeTools?: readonly string[];
  configuredConcurrency: number;
}): number {
  return effectiveToolSetRequiresSequentialExecution({
    requireToolApproval,
    tools,
    activeTools,
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
