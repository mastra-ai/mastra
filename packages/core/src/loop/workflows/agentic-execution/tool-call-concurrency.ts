import type { ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../../agent/message-list';
import type { IMastraLogger } from '../../../logger';
import type { RequestContext } from '../../../request-context';
import type { RequireToolApproval } from '../../../tools';
import { findProviderToolByName } from '../../../tools/provider-tool-utils';
import { evaluateToolCallGuard, getToolCallGuardState, hasToolCallGuard } from '../../../tools/tool-call-guard';
import type { ResolvedToolCallGuardVerdict } from '../../../tools/tool-call-guard';
import { getNeedsApprovalFn } from '../../../tools/toolchecks';
import type { ToolApprovalContext } from '../../../tools/types';
import type { ToolCallConcurrency, ToolCallConcurrencyStrategy } from '../../types';
import { buildToolApprovalContext, resolveToolApprovalVerdict } from './tool-approval-verdict';

export type ToolCallForeachOptions = {
  concurrency: number;
};

const DEFAULT_TOOL_CALL_CONCURRENCY = 10;

/**
 * Normalize the public `toolCallConcurrency` option (a number or an object with
 * `limit`/`strategy`) into a resolved `{ limit, strategy }` pair.
 */
export function normalizeToolCallConcurrency(toolCallConcurrency: ToolCallConcurrency | undefined): {
  limit: number;
  strategy: ToolCallConcurrencyStrategy;
} {
  if (typeof toolCallConcurrency === 'object' && toolCallConcurrency !== null) {
    const limit = toolCallConcurrency.limit;
    return {
      limit: typeof limit === 'number' && limit > 0 ? limit : DEFAULT_TOOL_CALL_CONCURRENCY,
      strategy: toolCallConcurrency.strategy ?? 'available',
    };
  }
  return {
    limit: toolCallConcurrency && toolCallConcurrency > 0 ? toolCallConcurrency : DEFAULT_TOOL_CALL_CONCURRENCY,
    strategy: 'available',
  };
}

export function resolveConfiguredToolCallConcurrency(toolCallConcurrency: ToolCallConcurrency | undefined): number {
  return normalizeToolCallConcurrency(toolCallConcurrency).limit;
}

export function effectiveToolSetRequiresSequentialExecution({
  requireToolApproval,
  tools,
  activeTools,
  strategy = 'available',
  calledToolNames,
  dynamicApprovalEvaluated = false,
}: {
  // A function-valued global approval policy is evaluated per call at execution time;
  // before args are known we conservatively treat it like `true` and force sequential
  // execution so approval suspensions never race with concurrent tool calls.
  requireToolApproval?: RequireToolApproval;
  tools?: ToolSet;
  activeTools?: readonly string[];
  strategy?: ToolCallConcurrencyStrategy;
  // The tool names the model actually called this step. Only consulted under the
  // `'called'` strategy; when omitted there, nothing forces sequential (a batch
  // that called no suspend/approval tool cannot suspend this step).
  calledToolNames?: readonly string[];
  // Set when the caller evaluates function approval policies per emitted call itself.
  // Function-valued policies (run-wide or a tool's `needsApprovalFn`) are then skipped here;
  // static approval flags and suspend schemas still apply.
  dynamicApprovalEvaluated?: boolean;
}): boolean {
  if (requireToolApproval === true || (requireToolApproval && !dynamicApprovalEvaluated)) {
    return true;
  }

  if (!tools) {
    return false;
  }

  const consideredToolEntries =
    strategy === 'called'
      ? (calledToolNames ?? []).flatMap(toolName => {
          // Mirror the tool-call step's lookup (key, provider name, then tool id).
          const tool =
            tools[toolName] ||
            findProviderToolByName(tools, toolName) ||
            Object.values(tools).find(t => 'id' in t && t.id === toolName);
          return tool ? ([[toolName, tool]] as const) : [];
        })
      : activeTools === undefined
        ? Object.entries(tools)
        : activeTools.flatMap(toolName => {
            const tool = tools[toolName];
            return tool ? ([[toolName, tool]] as const) : [];
          });

  return consideredToolEntries.some(([, tool]) => {
    const maybeTool = tool as { hasSuspendSchema?: unknown; requireApproval?: unknown };
    if (maybeTool.hasSuspendSchema) {
      return true;
    }
    // An unevaluated `needsApprovalFn` may require approval, so stay sequential.
    if (getNeedsApprovalFn(tool)) {
      return !dynamicApprovalEvaluated;
    }
    if (maybeTool.requireApproval) {
      return true;
    }
    // Likewise an unevaluated `guardToolCall` hook may answer `ask` and suspend for approval.
    return hasToolCallGuard(tool) && !dynamicApprovalEvaluated;
  });
}

export function resolveToolCallConcurrency({
  requireToolApproval,
  tools,
  activeTools,
  configuredConcurrency,
  strategy,
  calledToolNames,
}: {
  requireToolApproval?: RequireToolApproval;
  tools?: ToolSet;
  activeTools?: readonly string[];
  configuredConcurrency: number;
  strategy?: ToolCallConcurrencyStrategy;
  calledToolNames?: readonly string[];
}): number {
  return effectiveToolSetRequiresSequentialExecution({
    requireToolApproval,
    tools,
    activeTools,
    strategy,
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

/**
 * Resolves concurrency for a step once the model's tool calls are known.
 *
 * Each called tool's approval policy is evaluated with the call's actual arguments (the same rule
 * the tool-call step applies), so a function policy that returns `false` does not force sequential
 * execution. Called tools with a suspend schema, or whose policy requires approval for this call,
 * still force sequential execution. Under `'available'`, any active tool with a static approval
 * flag or suspend schema also forces sequential execution, as before.
 */
export async function resolveEmittedToolCallConcurrency({
  toolCalls,
  approvalVerdicts,
  guardVerdicts,
  getMessages,
  requestContext,
  workspace,
  logger,
  ...args
}: Parameters<typeof resolveToolCallConcurrency>[0] & {
  toolCalls: readonly { toolCallId?: string; toolName: string; args?: unknown }[];
  approvalVerdicts?: Map<string, boolean>;
  /** Receives the `guardToolCall` verdict of each call that rules left open, keyed by toolCallId. */
  guardVerdicts?: Map<string, ResolvedToolCallGuardVerdict>;
  /** Conversation passed to `guardToolCall`. */
  getMessages?: () => MastraDBMessage[];
  requestContext?: RequestContext;
  workspace?: ToolApprovalContext['workspace'];
  logger?: IMastraLogger;
}): Promise<number> {
  // Under 'available', static approval flags and suspend schemas on any active tool still
  // force sequential execution; only function policies are resolved per emitted call below.
  if (
    args.strategy !== 'called' &&
    effectiveToolSetRequiresSequentialExecution({ ...args, dynamicApprovalEvaluated: true })
  ) {
    return 1;
  }

  const findTool = (toolName: string) =>
    args.tools?.[toolName] ||
    findProviderToolByName(args.tools, toolName) ||
    Object.values(args.tools || {}).find(t => 'id' in t && t.id === toolName);
  const stripResumeData = (toolArgs: unknown) =>
    typeof toolArgs === 'object' && toolArgs !== null
      ? (({ resumeData: _resumeData, ...rest }) => rest)(toolArgs as Record<string, unknown>)
      : (toolArgs as ToolApprovalContext['args']);

  const verdicts = await Promise.all(
    toolCalls.map(async toolCall => {
      // Mirror the tool-call step's lookup (key, provider name, then tool id).
      const tool = findTool(toolCall.toolName);
      if (!tool) {
        return true;
      }
      if ((tool as { hasSuspendSchema?: unknown }).hasSuspendSchema) {
        return true;
      }
      const toolArgs = stripResumeData(toolCall.args);
      const verdict = await resolveToolApprovalVerdict({
        tool,
        requireToolApproval: args.requireToolApproval,
        context: buildToolApprovalContext({
          toolName: toolCall.toolName,
          args: toolArgs,
          requestContext,
          workspace,
        }),
        logger,
      });
      if (toolCall.toolCallId) {
        approvalVerdicts?.set(toolCall.toolCallId, verdict);
      }
      return verdict;
    }),
  );

  if (verdicts.some(Boolean)) {
    return 1;
  }

  // Rules left every call open, so each guarded call is decided by its guard. Guards run one
  // at a time in emission order so the run's denial counters (and escalation) are deterministic.
  // A call the guard sends to approval must suspend, which requires sequential execution.
  let anyAsk = false;
  let messages: MastraDBMessage[] | undefined;
  for (const toolCall of toolCalls) {
    const tool = findTool(toolCall.toolName);
    const guardState = getToolCallGuardState(tool);
    if (!guardState) {
      continue;
    }
    // Without somewhere to hand the verdict to the tool-call step, leave the guard to run
    // there instead (evaluating it twice would double-count denials) and stay sequential.
    if (!guardVerdicts || !toolCall.toolCallId) {
      anyAsk = true;
      continue;
    }
    messages ??= getMessages?.() ?? [];
    const verdict = await evaluateToolCallGuard({
      state: guardState,
      toolName: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      args: stripResumeData(toolCall.args),
      messages,
      requestContext,
      workspace,
      logger,
    });
    guardVerdicts?.set(toolCall.toolCallId, verdict);
    if (verdict.action === 'ask') {
      anyAsk = true;
    }
  }

  return anyAsk ? 1 : args.configuredConcurrency;
}
