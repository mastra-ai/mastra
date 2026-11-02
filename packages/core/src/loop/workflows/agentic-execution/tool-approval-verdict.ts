import type { ActorSignal } from '../../../auth/ee';
import type { IMastraLogger } from '../../../logger';
import type { RequestContext } from '../../../request-context';
import type { StandardSchemaWithJSON } from '../../../schema';
import type { RequireToolApproval } from '../../../tools';
import {
  getBeforeApprovalFn,
  getNeedsApprovalFn,
  isApprovalExempt,
  isBuiltBeforeApproval,
} from '../../../tools/toolchecks';
import type {
  BeforeApprovalContext,
  BeforeApprovalRuntime,
  ToolApprovalContext,
  ToolBeforeHookResult,
} from '../../../tools/types';
import { validateToolInput } from '../../../tools/validation';

type ToolInputValidator = (input: unknown) => { data?: unknown; error?: unknown };

type BeforeApprovalWithRuntime = (
  input: unknown,
  ctx: BeforeApprovalContext,
  runtime: BeforeApprovalRuntime,
) => void | ToolBeforeHookResult | Promise<void | ToolBeforeHookResult>;

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
  if (isApprovalExempt(tool)) return false;

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

/**
 * Runs the checks for a call that is about to suspend for approval: the tool's input
 * validation, then its `beforeApproval` hook. Returns `{ proceed: false, output }` when the
 * input is invalid (output is the same validation error `execute` would return) or when the
 * hook rejects the call; otherwise `undefined` so the call continues to the approval gate.
 * A hook that throws is logged and treated as "continue": the approval gate still protects
 * execution.
 */
export async function runBeforeApprovalChecks({
  tool,
  input,
  context,
  logger,
}: {
  tool: unknown;
  input: unknown;
  context: {
    toolCallId: string;
    toolName: string;
    requestContext?: RequestContext;
    workspace?: ToolApprovalContext['workspace'];
    actor?: ActorSignal;
  };
  logger?: IMastraLogger;
}): Promise<ToolBeforeHookResult | undefined> {
  // Built CoreTools expose `validateInput` (the schema execute uses); raw Tool instances on the
  // network loop still carry `inputSchema`.
  const validateInput = (tool as { validateInput?: unknown } | undefined)?.validateInput;
  const inputSchema = (tool as { inputSchema?: unknown } | undefined)?.inputSchema;
  const validation =
    typeof validateInput === 'function'
      ? (validateInput as ToolInputValidator)(input)
      : inputSchema
        ? validateToolInput(inputSchema as StandardSchemaWithJSON, input, context.toolName)
        : undefined;
  if (validation?.error) {
    logger?.warn(`Tool input validation failed before approval for tool ${context.toolName}`);
    return { proceed: false, output: validation.error };
  }
  if (validation) input = validation.data;

  const beforeApproval = getBeforeApprovalFn(tool);
  if (!beforeApproval) return undefined;

  const { requestContext } = buildToolApprovalContext({
    toolName: context.toolName,
    args: input as ToolApprovalContext['args'],
    requestContext: context.requestContext,
  });
  // Built tools run the TOOLS_EXECUTE authorization check inside their beforeApproval wrapper,
  // so they need the live request context and actor that execute would receive.
  // User hooks on raw Tool instances never receive these trusted values.
  const hookContext: BeforeApprovalContext = {
    toolCallId: context.toolCallId,
    toolName: context.toolName,
    requestContext,
    workspace: context.workspace,
  };
  try {
    const result = isBuiltBeforeApproval(beforeApproval)
      ? await (beforeApproval as BeforeApprovalWithRuntime)(input, hookContext, {
          requestContext: context.requestContext,
          actor: context.actor,
        })
      : await beforeApproval(input, hookContext);
    return result && typeof result === 'object' && result.proceed === false ? result : undefined;
  } catch (error) {
    // Authorization denials must fail the call the same way they do from execute.
    if (error instanceof Error && error.name === 'FGADeniedError') {
      throw error;
    }
    logger?.error(`Error calling beforeApproval for tool ${context.toolName}:`, error);
    return undefined;
  }
}
