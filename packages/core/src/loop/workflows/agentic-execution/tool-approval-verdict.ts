import type { IMastraLogger } from '../../../logger';
import type { RequestContext } from '../../../request-context';
import type { RequireToolApproval } from '../../../tools';
import { getNeedsApprovalFn } from '../../../tools/toolchecks';
import type { ToolApprovalContext } from '../../../tools/types';

export function buildToolApprovalContext({
  toolName,
  args,
  requestContext,
  workspace,
}: {
  toolName: string;
  args: ToolApprovalContext['args'];
  requestContext?: RequestContext;
  workspace?: ToolApprovalContext['workspace'];
}): ToolApprovalContext {
  return {
    toolName,
    args,
    // Exclude the internal approval hook so policies only see public request-context entries.
    requestContext: requestContext
      ? Object.fromEntries([...requestContext.entries()].filter(([key]) => key !== '__mastra_requireToolApproval'))
      : {},
    workspace,
  };
}

/**
 * Resolves whether a single tool call requires approval.
 *
 * The global `requireToolApproval` option (boolean, or a function evaluated per call) and the
 * tool's own boolean `requireApproval` flag seed the decision. A per-tool `needsApprovalFn`
 * (from `createTool({ requireApproval: fn })` or an MCP-derived tool) is authoritative when
 * present and overrides the seed. Any policy that throws defaults to requiring approval.
 *
 * Shared by the tool-call step and the tool-call concurrency resolver so both use one rule.
 */
export async function resolveToolApprovalVerdict({
  tool,
  requireToolApproval,
  context,
  logger,
}: {
  tool: unknown;
  requireToolApproval?: RequireToolApproval;
  context: ToolApprovalContext;
  logger?: IMastraLogger;
}): Promise<boolean> {
  let globalRequiresApproval: boolean;
  if (typeof requireToolApproval === 'function') {
    try {
      globalRequiresApproval = !!(await requireToolApproval(context));
    } catch (error) {
      logger?.error(`Error evaluating global requireToolApproval for tool ${context.toolName}:`, error);
      globalRequiresApproval = true;
    }
  } else {
    globalRequiresApproval = !!requireToolApproval;
  }

  const needsApprovalFn = getNeedsApprovalFn(tool);
  if (!needsApprovalFn) {
    return globalRequiresApproval || !!(tool as { requireApproval?: unknown } | undefined)?.requireApproval;
  }

  try {
    const { toolName: _toolName, ...needsApprovalCtx } = context;
    return !!(await needsApprovalFn(context.args as any, needsApprovalCtx));
  } catch (error) {
    logger?.error(`Error evaluating needsApprovalFn for tool ${context.toolName}:`, error);
    return true;
  }
}
