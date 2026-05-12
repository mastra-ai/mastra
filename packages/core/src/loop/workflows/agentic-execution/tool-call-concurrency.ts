import type { ToolSet } from '@internal/ai-sdk-v5';
import { getInternalToolExecutionHints, resolveInternalExecutionHint } from '../../../tools/internal-execution-hints';
import { findProviderToolByName } from '../../../tools/provider-tool-utils';

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
  requireToolApproval?: boolean;
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

type ToolCallLike = {
  toolName: string;
  args?: unknown;
};

function findToolForCall(tools: ToolSet | undefined, toolName: string) {
  return (
    tools?.[toolName] ||
    findProviderToolByName(tools, toolName) ||
    Object.values(tools || {})?.find((tool: any) => `id` in tool && tool.id === toolName)
  );
}

function toolCallRequiresSequentialExecution({
  requireToolApproval,
  tool,
  args,
}: {
  requireToolApproval?: boolean;
  tool: unknown;
  args: unknown;
}): boolean {
  const maybeTool = (tool ?? {}) as { hasSuspendSchema?: unknown; requireApproval?: unknown };
  const internalExecutionHints = getInternalToolExecutionHints(tool);
  const bypassGlobalToolApproval =
    resolveInternalExecutionHint(internalExecutionHints?.bypassGlobalToolApproval, args) &&
    !maybeTool.requireApproval &&
    !maybeTool.hasSuspendSchema;
  const safeForConcurrentExecution =
    resolveInternalExecutionHint(internalExecutionHints?.safeForConcurrentExecution, args) && bypassGlobalToolApproval;

  return (
    !safeForConcurrentExecution && Boolean(requireToolApproval || maybeTool.requireApproval || maybeTool.hasSuspendSchema)
  );
}

export function effectiveToolCallsRequireSequentialExecution({
  requireToolApproval,
  tools,
  toolCalls,
}: {
  requireToolApproval?: boolean;
  tools?: ToolSet;
  toolCalls: readonly ToolCallLike[];
}): boolean {
  return toolCalls.some(toolCall =>
    toolCallRequiresSequentialExecution({
      requireToolApproval,
      tool: findToolForCall(tools, toolCall.toolName),
      args: toolCall.args,
    }),
  );
}

export function resolveToolCallConcurrency({
  requireToolApproval,
  tools,
  activeTools,
  toolCalls,
  configuredConcurrency,
}: {
  requireToolApproval?: boolean;
  tools?: ToolSet;
  activeTools?: readonly string[];
  toolCalls?: readonly ToolCallLike[];
  configuredConcurrency: number;
}): number {
  const requiresSequentialExecution = toolCalls
    ? effectiveToolCallsRequireSequentialExecution({
        requireToolApproval,
        tools,
        toolCalls,
      })
    : effectiveToolSetRequiresSequentialExecution({
        requireToolApproval,
        tools,
        activeTools,
      });

  return requiresSequentialExecution ? 1 : configuredConcurrency;
}

export function updateToolCallForeachConcurrency(
  options: ToolCallForeachOptions,
  args: Parameters<typeof resolveToolCallConcurrency>[0],
) {
  options.concurrency = resolveToolCallConcurrency(args);
}
